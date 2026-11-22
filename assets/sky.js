(function(){
  var host=document.getElementById('sky');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl=null;

  function initGL(){
    if(!window.THREE||!THREE.EffectComposer||!THREE.TrackballControls)return null;
    var renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});}catch(e){return null;}
    var w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25,Math.sqrt(1800000/(w*h))));
    renderer.setSize(w,h);renderer.setClearColor(0x000000,1);
    host.appendChild(renderer.domElement);

    var scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,w/h,.1,3000);
    var tn=Math.tan(55*Math.PI/360),d0=Math.max(15,9.6/(tn*(w/h)));
    camera.position.set(-.86*d0,.23*d0,.5*d0);

    /* stars */
    var N=32000,pos=new Float32Array(N*3),col=new Float32Array(N*3),sz=new Float32Array(N),tw=new Float32Array(N),i,u,a,s,R,k,b;
    for(i=0;i<N;i++){
      u=Math.random()*2-1;a=Math.random()*6.2832;s=Math.sqrt(1-u*u);R=600+Math.random()*600;
      pos[i*3]=R*s*Math.cos(a);pos[i*3+1]=R*u;pos[i*3+2]=R*s*Math.sin(a);
      k=Math.random();b=.25+Math.random()*.75;
      col[i*3]=(k<.6?.9:k<.85?1:.6)*b;col[i*3+1]=(k<.6?.92:k<.85?.85:.75)*b;col[i*3+2]=(k<.6?1:k<.85?.65:1)*b;
      sz[i]=.8+Math.random()*1.6;tw[i]=Math.random()*6.28;
    }
    var sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    sg.setAttribute('aCol',new THREE.BufferAttribute(col,3));
    sg.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
    sg.setAttribute('aTw',new THREE.BufferAttribute(tw,1));
    var starU={uT:{value:0},uPR:{value:renderer.getPixelRatio()}};
    scene.add(new THREE.Points(sg,new THREE.ShaderMaterial({
      uniforms:starU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`
        uniform float uT,uPR;attribute vec3 aCol;attribute float aSize,aTw;varying vec3 vC;
        void main(){vC=aCol*(.78+.22*sin(uT*1.7+aTw));gl_PointSize=aSize*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec3 vC;
        void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vC*(1.-min(d,.5)*1.6),1.-smoothstep(.20,.5,d));}`
    })));

    // Convert camera axes to disk coordinates (the disk lies in the XY plane).
    var toDisk=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,.12,'ZXY')).invert();
    var composer=new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene,camera));
    var lens=new THREE.ShaderPass({
      uniforms:{tDiffuse:{value:null},uEye:{value:new THREE.Vector3()},uRight:{value:new THREE.Vector3()},
        uUp:{value:new THREE.Vector3()},uA:{value:w/h},uTan:{value:tn},uT:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform sampler2D tDiffuse;
        uniform vec3 uEye,uRight,uUp;
        uniform float uA,uTan,uT;
        varying vec2 vUv;
        const float RI=2.35,RO=9.5,RS=.75;
        float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        float vn(vec3 x){
          vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        vec3 ramp(float t){
          vec3 c=mix(vec3(1.,.93,.78),vec3(1.,.58,.18),smoothstep(0.,.3,t));
          return mix(c,vec3(.55,.16,.05),smoothstep(.3,.9,t));
        }

        vec3 acceleration(vec3 p,float h2){
          float invR2=1./max(dot(p,p),RS*RS);
          return -1.5*RS*h2*p*invR2*invR2*sqrt(invR2);
        }
        void main(){
          vec2 screen=(vUv-.5)*vec2(uA,1.);
          vec3 ray=normalize(-normalize(uEye)+2.*uTan*(uRight*screen.x+uUp*screen.y));
          vec3 h=cross(uEye,ray);
          float h2=dot(h,h);
          // Suppress unresolved higher-order images close to the capture boundary.
          float impact=sqrt(h2);
          float critical=2.598076*RS;
          float footprint=max(fwidth(impact),.005);
          float indirect=smoothstep(.04+footprint,.12+4.*footprint,abs(impact-critical));
          float closest=length(uEye);
          vec3 light=vec3(0.);
          float transmission=1.;
          // Start outside the gas even when the camera is zoomed out.
          float entry=max(0.,-dot(uEye,ray)-sqrt(max(121.-h2,0.)));
          vec3 pos=uEye+ray*entry;
          if(h2<121.){
            for(int i=0;i<216;i++){
              float radius=length(pos);
              if(radius<RS || (impact<critical && radius<1.5*RS)){transmission=0.;break;}
              if(radius>11.1 && dot(pos,ray)>0.)break;
              closest=min(closest,radius);
              float foreground=mix(indirect*.55,1.,smoothstep(1.7*RS,2.4*RS,closest));
              float ds=clamp(radius*.055,.04,mix(.26,.8,smoothstep(.5,1.5,abs(pos.z))));
              vec3 halfRay=ray+.5*ds*acceleration(pos,h2);
              vec3 next=pos+ds*halfRay;
              // Integrate only the part of this segment inside the gas slab.
              if(min(abs(pos.z),abs(next.z))<.46 || pos.z*next.z<=0.){
                float dz=next.z-pos.z;
                vec2 ends=abs(dz)<1e-6 ? vec2(0.,1.)
                    : clamp((vec2(-.46,.46)-pos.z)/dz,0.,1.);
                // Two quadrature samples reduce bands as a curved ray crosses the disk.
                for(int sampleIndex=0;sampleIndex<2;sampleIndex++){
                  float fraction=.5+(float(sampleIndex)-.5)*.57735027;
                  vec3 gas=mix(pos,next,mix(min(ends.x,ends.y),max(ends.x,ends.y),fraction));
                  float r=length(gas.xy);
                  if(r>RI && r<RO){
                    float t=(r-RI)/(RO-RI);
                    float height=.065+.23*sin(3.14159*t);
                    float z=gas.z/height;
                    float envelope=exp(-2.5*z*z)*(1.-smoothstep(.32,.46,abs(gas.z)))*smoothstep(0.,.085,t)*(1.-smoothstep(.57,1.,t));
                    float a=.45*r-uT*.26;
                    vec2 flow=mat2(cos(a),sin(a),-sin(a),cos(a))*gas.xy;
                    float eddy=vn(vec3(flow*.95,uT*.045));
                    float thread=vn(vec3(r*7.+1.9*eddy,flow*.9));
                    float density=(.47+.55*thread)*(.72+.56*eddy);
                    float opacity=1.-exp(-1.75*envelope*density*ds*abs(ends.y-ends.x));
                    float beam=dot(vec2(-gas.y,gas.x)/r,-normalize(halfRay).xy);
                    vec3 emission=ramp(t)*(.09+1.9*pow(1.-t,2.8))*density*clamp(1.+.85*beam,.22,1.85);
                    light+=foreground*transmission*opacity*emission;
                    transmission*=1.-opacity;
                  }
                }
              }
              ray=halfRay+.5*ds*acceleration(next,h2);
              pos=next;
            }
          }
          float e=1.95/(2.*uTan*length(uEye));
          vec2 bent=screen*(1.-e*e/max(dot(screen,screen),1e-6));
          transmission*=smoothstep(critical-footprint,critical+footprint,impact);
          light+=transmission*texture2D(tDiffuse,.5+bent/vec2(uA,1.)).rgb;
          vec3 c=1.-exp(-light*1.15);
          c=mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
          float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
          gl_FragColor=vec4(c+(grain-.5)/255.,1.);
        }`
    });
    lens.material.extensions.derivatives=true;
    composer.addPass(lens);

    var ctl=new THREE.TrackballControls(camera,renderer.domElement);
    ctl.noPan=true;ctl.rotateSpeed=2.2;ctl.zoomSpeed=.8;ctl.staticMoving=reduce;
    ctl.minDistance=8;ctl.maxDistance=50;ctl.keys=[-1,-1,-1];
    var lastT=0,AX=new THREE.Vector3(0,1,0),dom=renderer.domElement;
    dom.addEventListener('dblclick',function(){ctl.reset();});

    var clock=new THREE.Clock();
    return {
      rs:function(){
        var w2=host.clientWidth,h2=host.clientHeight;if(!w2||!h2)return;
        renderer.setSize(w2,h2);composer.setSize(w2,h2);
        camera.aspect=w2/h2;camera.updateProjectionMatrix();lens.uniforms.uA.value=w2/h2;ctl.handleResize();
      },
      draw:function(){
        var t=reduce?0:clock.getElapsedTime();
        lens.uniforms.uT.value=t;starU.uT.value=t;
        var dt=Math.min(.05,t-lastT);lastT=t;
        if(!reduce){
          var da=.06*dt;
          camera.position.applyAxisAngle(AX,da);
          camera.up.applyAxisAngle(AX,da);
        }
        // Trackball rotation retains sqrt(1 - damping) of its speed per update.
        // Use elapsed time so the glide decays smoothly at different frame rates.
        if(!reduce)ctl.dynamicDampingFactor=1.-Math.exp(-12*dt);
        ctl.update();
        lens.uniforms.uEye.value.copy(camera.position).applyQuaternion(toDisk);
        lens.uniforms.uRight.value.set(1,0,0).applyQuaternion(camera.quaternion).applyQuaternion(toDisk);
        lens.uniforms.uUp.value.set(0,1,0).applyQuaternion(camera.quaternion).applyQuaternion(toDisk);
        composer.render();
      }
    };
  }


  gl=initGL();
  if(!gl)return;
  window.addEventListener('resize',gl.rs);
  function loop(){
    if(!document.hidden && !host.hidden)gl.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
