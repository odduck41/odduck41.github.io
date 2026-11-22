(function(){
  var host=document.getElementById('sky');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl=null;

  function initGL(){
    if(!window.THREE||!THREE.EffectComposer||!THREE.TrackballControls||!THREE.UnrealBloomPass)return null;
    var renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});}catch(e){return null;}
    var w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,Math.min(w,h)<700?1.5:2));
    renderer.setSize(w,h);renderer.setClearColor(0x000000,1);
    host.appendChild(renderer.domElement);

    var scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,w/h,.1,3000);
    var tn=Math.tan(55*Math.PI/360),d0=Math.max(15,9.6/(tn*(w/h)));
    camera.position.set(-.86*d0,.23*d0,.5*d0);

    /* accretion disk */
    var diskU={uT:{value:0},uEye:{value:new THREE.Vector3()}};
    // Draw the exit face so each ray is integrated once, including from inside the box.
    var disk=new THREE.Mesh(new THREE.BoxGeometry(19,19,1.4),new THREE.ShaderMaterial({
      uniforms:diskU,transparent:true,depthWrite:false,side:THREE.BackSide,
      vertexShader:`
        varying vec3 vExit;
        void main(){
          vExit=position;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader:`
        uniform float uT;
        uniform vec3 uEye;
        varying vec3 vExit;
        const float RI=2.3,RO=9.5;
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
        void main(){
          vec3 ray=normalize(vExit-uEye);
          vec3 halfSize=vec3(RO,RO,.7);
          // Distance from the exit face back to the first box boundary.
          vec3 toEntry=(halfSize+sign(ray)*vExit)/max(abs(ray),vec3(.000001));
          float span=min(length(vExit-uEye),min(toEntry.x,min(toEntry.y,toEntry.z)));
          const int STEPS=40;
          float ds=span/float(STEPS);
          vec3 pos=vExit-ray*(span-.5*ds);
          vec3 light=vec3(0.);
          float transmittance=1.;
          for(int i=0;i<STEPS;i++){
            float r=length(pos.xy);
            float t=clamp((r-RI)/(RO-RI),0.,1.);
            float height=.10+.58*sin(3.14159*t);
            float envelope=(1.-smoothstep(0.,1.,abs(pos.z)/height))
                          *smoothstep(0.,.05,t)*(1.-smoothstep(.65,1.,t));
            if(envelope>0.){
              float angle=-uT*.38-.65*sin(r*.62-uT*.23);
              vec2 flow=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*pos.xy;
              vec3 noisePos=vec3(flow*.75,pos.z*1.4+uT*.08);
              float cloud=.68*vn(noisePos)+.32*vn(noisePos*2.03);
              float opacity=1.-exp(-ds*envelope*(.35+1.5*cloud));
              float beam=dot(vec2(-pos.y,pos.x)/r,-ray.xy);
              vec3 emission=ramp(t)*(.25+3.*pow(1.-t,2.4))
                                  *(.35+1.4*cloud)*clamp(1.+.85*beam,.25,2.);
              light+=transmittance*opacity*emission;
              transmittance*=1.-opacity;
            }
            pos+=ray*ds;
          }
          float alpha=1.-transmittance;
          gl_FragColor=vec4(light/max(alpha,.00001),alpha);
        }`
    }));
    disk.rotation.x=-Math.PI/2;
    disk.rotation.order='ZXY';
    disk.rotation.z=.12;
    disk.renderOrder=1;
    scene.add(disk);

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
        void main(){vC=aCol*(.55+.45*sin(uT*1.7+aTw));gl_PointSize=aSize*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec3 vC;
        void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vC*(1.-d*1.6),1.);}`
    })));

    /* post: bloom, then gravitational lens + tone map */
    var hdr=renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    var composer=new THREE.EffectComposer(renderer);
    if(hdr){
      composer.renderTarget1.texture.type=THREE.HalfFloatType;
      composer.renderTarget2.texture.type=THREE.HalfFloatType;
    }
    composer.addPass(new THREE.RenderPass(scene,camera));
    var lens=new THREE.ShaderPass({
      uniforms:{tDiffuse:{value:null},uE:{value:.13},uA:{value:w/h}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform sampler2D tDiffuse;uniform float uE,uA;varying vec2 vUv;
        void main(){
          vec2 p=(vUv-.5)*vec2(uA,1.);
          float th=length(p);
          vec2 dir=p/max(th,1e-4);
          float b=th-uE*uE/max(th,1e-3);
          vec3 c=texture2D(tDiffuse,dir*b/vec2(uA,1.)+.5).rgb;
          c*=smoothstep(uE*.86,uE*.9,th);
          float q=(th-uE*.92)/(uE*.025);
          c+=vec3(1.,.85,.6)*exp(-q*q)*.9;
          gl_FragColor=vec4(c,1.);
        }`
    });
    composer.addPass(lens);
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(w,h),.5,.25,.8));
    var fin=new THREE.ShaderPass({
      uniforms:{tDiffuse:{value:null},uE:{value:.13},uA:{value:w/h}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform sampler2D tDiffuse;uniform float uE,uA;varying vec2 vUv;
        float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        void main(){
          vec3 c=texture2D(tDiffuse,vUv).rgb;
          float th=length((vUv-.5)*vec2(uA,1.));
          c*=smoothstep(uE*.86,uE*.9,th);
          c*=1.-.5*smoothstep(.35,.85,length(vUv-.5));
          c=1.-exp(-c*1.15);
          c=pow(c,vec3(1./2.2));
          c+=(rnd(gl_FragCoord.xy)+rnd(gl_FragCoord.xy+17.)-1.)*1.5/255.;
          gl_FragColor=vec4(c,1.);
        }`
    });
    composer.addPass(fin);

    var ctl=new THREE.TrackballControls(camera,renderer.domElement);
    ctl.noPan=true;ctl.rotateSpeed=2.2;ctl.zoomSpeed=.8;ctl.staticMoving=false;ctl.dynamicDampingFactor=.07;
    ctl.minDistance=8;ctl.maxDistance=50;ctl.keys=[-1,-1,-1];
    var lastT=0,dragging=false,AX=new THREE.Vector3(0,1,0),dom=renderer.domElement;
    dom.addEventListener('pointerdown',function(){dragging=true;});
    window.addEventListener('pointerup',function(){dragging=false;});
    window.addEventListener('pointercancel',function(){dragging=false;});
    dom.addEventListener('dblclick',function(){ctl.reset();});

    var clock=new THREE.Clock(),tanH=Math.tan(camera.fov*Math.PI/360);
    return {
      rs:function(){
        var w2=host.clientWidth,h2=host.clientHeight;if(!w2||!h2)return;
        renderer.setSize(w2,h2);composer.setSize(w2,h2);
        camera.aspect=w2/h2;camera.updateProjectionMatrix();lens.uniforms.uA.value=w2/h2;fin.uniforms.uA.value=w2/h2;ctl.handleResize();
      },
      draw:function(){
        var t=reduce?0:clock.getElapsedTime();
        diskU.uT.value=t;starU.uT.value=t;
        var dt=Math.min(.05,t-lastT);lastT=t;
        if(!reduce&&!dragging){var da=.06*dt;camera.position.applyAxisAngle(AX,da);camera.up.applyAxisAngle(AX,da);}
        ctl.update();
        disk.worldToLocal(diskU.uEye.value.copy(camera.position));
        lens.uniforms.uE.value=(2/camera.position.length())/(2*tanH);fin.uniforms.uE.value=lens.uniforms.uE.value;
        composer.render();
      }
    };
  }


  gl=initGL();
  if(!gl)return;
  window.addEventListener('resize',gl.rs);
  function loop(){
    if(!document.hidden)gl.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
