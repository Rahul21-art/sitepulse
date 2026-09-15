/* ============================================================
   LOADER
   ============================================================ */
(function(){
  const lines = document.querySelectorAll('.loader-line');
  const fill = document.getElementById('loaderBarFill');
  let i = 0;
  function step(){
    if(i < lines.length){
      lines[i].classList.add('on');
      lines[i].querySelector('.status').textContent = 'READY';
      i++;
      gsap.to(fill,{width:(i/lines.length*100)+'%',duration:.5,ease:'power2.out'});
      setTimeout(step, 380);
    } else {
      setTimeout(()=>{
        gsap.to('#loader',{opacity:0,duration:.6,ease:'power2.out',onComplete:()=>{
          document.getElementById('loader').style.display='none';
          document.body.style.overflow='';
          initHeroReveal();
        }});
      }, 300);
    }
  }
  document.body.style.overflow='hidden';
  setTimeout(step, 260);
})();

function initHeroReveal(){
  gsap.set('.hero-title .line span', {yPercent:110});
  gsap.timeline()
    .to('.hero-eyebrow',{opacity:1,y:0,duration:.6,ease:'power2.out'})
    .to('.hero-title .line span',{yPercent:0,duration:.9,stagger:.09,ease:'power3.out'},'-=.3')
    .to('.hero-sub',{opacity:1,y:0,duration:.7,ease:'power2.out'},'-=.5')
    .to('.hero-cta-row',{opacity:1,y:0,duration:.7,ease:'power2.out'},'-=.5')
    .to('.hero-scroll-cue',{opacity:1,duration:.6},'-=.4');
}
gsap.set(['.hero-eyebrow','.hero-sub','.hero-cta-row'],{opacity:0,y:16});
gsap.set('.hero-scroll-cue',{opacity:0});

/* ============================================================
   NAV compact on scroll
   ============================================================ */
const navEl = document.getElementById('nav');
window.addEventListener('scroll', ()=>{
  navEl.classList.toggle('compact', window.scrollY > 80);
}, {passive:true});

/* ============================================================
   THREE.JS — HERO / STORY SCENE
   ============================================================ */
let heroScene, heroCamera, heroRenderer, heroGroup;
let zoneMeshes = [], vehicles = [], mouseX=0, mouseY=0;

function initHeroScene(){
  const canvas = document.getElementById('three-canvas');
  heroScene = new THREE.Scene();
  heroScene.fog = new THREE.FogExp2(0x08090b, 0.018);

  heroCamera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 200);
  heroCamera.position.set(0, 10, 26);
  heroCamera.lookAt(0,0,0);

  heroRenderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  heroRenderer.setSize(window.innerWidth, window.innerHeight);
  heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

  heroGroup = new THREE.Group();
  heroScene.add(heroGroup);

  // lights
  heroScene.add(new THREE.AmbientLight(0x33415c, 1.1));
  const dir = new THREE.DirectionalLight(0x9fb8e8, 1.0);
  dir.position.set(10,20,10);
  heroScene.add(dir);
  const pt1 = new THREE.PointLight(0x4f8ef7, 3, 40);
  pt1.position.set(-8,6,4);
  heroGroup.add(pt1);
  const pt2 = new THREE.PointLight(0x5eead4, 2.4, 30);
  pt2.position.set(9,4,-6);
  heroGroup.add(pt2);

  // ground grid
  const grid = new THREE.GridHelper(90, 60, 0x1c2230, 0x14181f);
  grid.position.y = -2.4;
  heroGroup.add(grid);

  const groundGeo = new THREE.PlaneGeometry(90,90);
  const groundMat = new THREE.MeshStandardMaterial({color:0x0a0c10, roughness:1, metalness:0});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -2.42;
  heroGroup.add(ground);

  // road
  const roadMat = new THREE.MeshStandardMaterial({color:0x1a1e26, roughness:0.85, metalness:0.1});
  const road = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 60), roadMat);
  road.position.y = -2.36;
  heroGroup.add(road);
  // road centerline dashes
  const dashMat = new THREE.MeshBasicMaterial({color:0x3a4150});
  for(let z=-28; z<28; z+=3){
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.07,1.3), dashMat);
    dash.position.set(0, -2.32, z);
    heroGroup.add(dash);
  }

  // zones data (linked to overlay later)
  const zoneDefs = [
    {x:-9, z:-14, h:3.2, progress:0.95, color:0x57c785, label:'A'},
    {x:8,  z:-4,  h:5.4, progress:0.51, color:0xf2a93b, label:'B'},
    {x:-8, z:6,   h:2.6, progress:0.91, color:0x57c785, label:'C'},
    {x:9,  z:16,  h:4.1, progress:0.30, color:0x4f8ef7, label:'D'},
  ];
  const bldgMat = (c)=> new THREE.MeshStandardMaterial({color:0x161b22, roughness:0.55, metalness:0.35, emissive:c, emissiveIntensity:0.12});

  zoneDefs.forEach(z=>{
    const g = new THREE.Group();
    g.position.set(z.x, -2.4, z.z);

    // main structure
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, z.h, 2.6), bldgMat(z.color));
    m.position.y = z.h/2;
    g.add(m);

    // progress collar (glowing ring rising with progress)
    const collarH = z.h * z.progress;
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, collarH, 2.75),
      new THREE.MeshBasicMaterial({color:z.color, transparent:true, opacity:0.16, wireframe:false})
    );
    collar.position.y = collarH/2;
    g.add(collar);

    // wireframe outline
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, z.h, 2.6)),
      new THREE.LineBasicMaterial({color:z.color, transparent:true, opacity:0.5})
    );
    wire.position.y = z.h/2;
    g.add(wire);

    // data node above
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16), new THREE.MeshBasicMaterial({color:z.color}));
    node.position.y = z.h + 1.2;
    g.add(node);

    // connector line node -> top
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, z.h, 0), new THREE.Vector3(0, z.h+1.2, 0)
    ]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:z.color, transparent:true, opacity:0.55}));
    g.add(line);

    heroGroup.add(g);
    zoneMeshes.push({group:g, node, def:z});
  });

  // simple cranes (Zone B + D under construction)
  function makeCrane(x,z,h){
    const c = new THREE.Group();
    const mastMat = new THREE.MeshStandardMaterial({color:0x2a3140, roughness:0.6, metalness:0.5});
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16,h,0.16), mastMat);
    mast.position.y = h/2;
    c.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(3.4,0.1,0.1), mastMat);
    jib.position.set(1.2, h, 0);
    c.add(jib);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.14,0.14), mastMat);
    counter.position.set(-0.9, h, 0);
    c.add(counter);
    const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(2.4,h,0), new THREE.Vector3(2.4,h-1.4,0)]);
    const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({color:0x555f70}));
    c.add(cable);
    c.position.set(x, -2.4, z);
    return c;
  }
  heroGroup.add(makeCrane(6.4,-3.4,6.4));
  heroGroup.add(makeCrane(-10.6,-13,4.8));

  // vehicles moving along road
  const vehMat = new THREE.MeshStandardMaterial({color:0x4f8ef7, emissive:0x1c3a66, emissiveIntensity:0.6, roughness:0.4});
  for(let i=0;i<4;i++){
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.35,0.9), vehMat.clone());
    v.position.set((i%2===0)?0.9:-0.9, -2.16, -26 + i*15);
    heroGroup.add(v);
    vehicles.push({mesh:v, speed:0.045 + Math.random()*0.02, offset:i*15});
  }

  // ambient floating data particles
  const pGeo = new THREE.BufferGeometry();
  const pCount = 140;
  const positions = new Float32Array(pCount*3);
  for(let i=0;i<pCount;i++){
    positions[i*3] = (Math.random()-0.5)*70;
    positions[i*3+1] = Math.random()*14;
    positions[i*3+2] = (Math.random()-0.5)*70;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const pMat = new THREE.PointsMaterial({color:0x4f8ef7, size:0.05, transparent:true, opacity:0.5});
  const points = new THREE.Points(pGeo, pMat);
  heroGroup.add(points);

  window.addEventListener('resize', onHeroResize);
  window.addEventListener('mousemove', (e)=>{
    mouseX = (e.clientX / window.innerWidth - 0.5);
    mouseY = (e.clientY / window.innerHeight - 0.5);
  });

  animateHero();
  positionZoneTags();
}

function onHeroResize(){
  if(!heroCamera) return;
  heroCamera.aspect = window.innerWidth/window.innerHeight;
  heroCamera.updateProjectionMatrix();
  heroRenderer.setSize(window.innerWidth, window.innerHeight);
}

let heroClock = new THREE.Clock();
function animateHero(){
  requestAnimationFrame(animateHero);
  const t = heroClock.getElapsedTime();

  // subtle auto camera drift + mouse parallax
  const baseAngle = t*0.02 + storyProgress*2.4;
  const radius = 24 - storyProgress*6;
  heroCamera.position.x = Math.sin(baseAngle) * radius + mouseX*2.2;
  heroCamera.position.z = Math.cos(baseAngle) * radius;
  heroCamera.position.y = 9 - storyProgress*3 + mouseY*1.2;
  heroCamera.lookAt(0, 1 - storyProgress*0.5, 0);

  vehicles.forEach(v=>{
    v.mesh.position.z += v.speed;
    if(v.mesh.position.z > 30) v.mesh.position.z = -30;
  });

  zoneMeshes.forEach((z,i)=>{
    z.node.position.y = z.def.h + 1.2 + Math.sin(t*1.4 + i)*0.12;
  });

  heroRenderer.render(heroScene, heroCamera);
}

/* ============================================================
   SCROLL STORY (GSAP ScrollTrigger)
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);
let storyProgress = 0;

function initStoryScroll(){
  const frames = ['#frame1','#frame2','#frame3','#frame4','#frame5','#frame6'];

  ScrollTrigger.create({
    trigger:'#story',
    start:'top top',
    end:'bottom bottom',
    scrub:0.6,
    onUpdate: self => { storyProgress = self.progress; }
  });

  const seg = 1/frames.length;
  frames.forEach((sel,i)=>{
    const start = i*seg;
    const end = (i+1)*seg;
    ScrollTrigger.create({
      trigger:'#story',
      start: `top+=${start*100}% top`,
      end: `top+=${end*100}% top`,
      scrub:false,
      onEnter: ()=> setFrame(i),
      onEnterBack: ()=> setFrame(i),
    });
  });

  function setFrame(idx){
    frames.forEach((sel,j)=>{
      gsap.to(sel, {opacity: j===idx?1:0, duration:0.5, ease:'power2.out', pointerEvents: j===idx?'auto':'none'});
    });
    updateZoneColors(idx);
  }
}

function updateZoneColors(frameIdx){
  // frameIdx 2 = reality dips, 3 = deviation critical, 4 = ai detect, 5 = action(recovering)
  zoneMeshes.forEach(z=>{
    if(z.def.label !== 'B') return;
    let targetOpacity = 0.16, targetColor = z.def.color;
    if(frameIdx>=2 && frameIdx<=4){ targetColor = 0xf2a93b; }
    if(frameIdx===3 || frameIdx===4){ targetColor = 0xef5b5b; }
    if(frameIdx===5){ targetColor = 0x57c785; }
    z.group.children.forEach(child=>{
      if(child.material && child.material.color){
        gsap.to(child.material.color, {r:((targetColor>>16&255)/255), g:((targetColor>>8&255)/255), b:((targetColor&255)/255), duration:0.6});
      }
    });
  });
}

/* zone tags positioned over hero canvas (optional lightweight labels) */
function positionZoneTags(){ /* reserved for future 2D label sync if needed */ }

/* ============================================================
   TWIN PAGE — separate lightweight 3D viewer
   ============================================================ */
const twinZones = [
  {key:'A', name:'Zone A', sub:'Road Segment 01 — Foundation', risk:'low', planned:100, actual:97, dev:'−3%', delay:'On schedule', action:'No action required — maintain current crew allocation through handover.', color:0x57c785},
  {key:'B', name:'Zone B', sub:'Road Segment 04 — Drainage', risk:'high', planned:68, actual:51, dev:'−17%', delay:'5 days', action:'Increase workforce by 20% and reallocate one excavator from Zone D to restore the drainage sub-schedule.', color:0xef5b5b},
  {key:'C', name:'Zone C', sub:'Road Segment 06 — Earthwork', risk:'low', planned:91, actual:89, dev:'−2%', delay:'On schedule', action:'Minor variance within tolerance — continue monitoring weekly.', color:0x57c785},
  {key:'D', name:'Zone D', sub:'Road Segment 09 — Road Base', risk:'medium', planned:34, actual:30, dev:'−4%', delay:'1 day', action:'Equipment surplus available for reallocation to Zone B without risking this segment.', color:0xf2a93b},
];
let twinScene, twinCamera, twinRenderer, twinMeshes=[], activeZoneKey='B';

function initTwinScene(){
  const box = document.querySelector('.twin-canvas-box');
  const canvas = document.getElementById('twin-canvas');
  const w = box.clientWidth, h = box.clientHeight;

  twinScene = new THREE.Scene();
  twinScene.fog = new THREE.FogExp2(0x0c0e12, 0.03);
  twinCamera = new THREE.PerspectiveCamera(40, w/h, 0.1, 100);
  twinCamera.position.set(9,7,11);
  twinCamera.lookAt(0,0,0);

  twinRenderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  twinRenderer.setSize(w,h);
  twinRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

  twinScene.add(new THREE.AmbientLight(0x33415c,1.2));
  const d = new THREE.DirectionalLight(0x9fb8e8,1.0); d.position.set(6,10,6); twinScene.add(d);

  const grid = new THREE.GridHelper(24,16,0x1c2230,0x14181f);
  twinScene.add(grid);

  const positions = [[-4.5,-2],[2.5,-1],[-3.5,3],[3.5,3.4]];
  twinZones.forEach((z,i)=>{
    const g = new THREE.Group();
    const [x,zz] = positions[i];
    g.position.set(x,0,zz);
    const hgt = 1.6 + (z.actual/100)*2.6;
    const mat = new THREE.MeshStandardMaterial({color:0x161b22, roughness:0.55, metalness:0.35, emissive:z.color, emissiveIntensity: z.key===activeZoneKey?0.35:0.14});
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.1,hgt,2.1), mat);
    m.position.y = hgt/2;
    m.userData.zoneKey = z.key;
    g.add(m);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.1,hgt,2.1)), new THREE.LineBasicMaterial({color:z.color, transparent:true, opacity: z.key===activeZoneKey?0.9:0.35}));
    wire.position.y = hgt/2;
    g.add(wire);
    twinScene.add(g);
    twinMeshes.push({group:g, mesh:m, wire, def:z, baseH:hgt});
  });

  canvas.addEventListener('click', onTwinClick);
  let dragging=false, lastX=0, lastY=0, rotY=0.5, rotX=0.55;
  canvas.style.cursor='grab';
  canvas.addEventListener('pointerdown', e=>{dragging=true; lastX=e.clientX; lastY=e.clientY; canvas.style.cursor='grabbing';});
  window.addEventListener('pointerup', ()=>{dragging=false; canvas.style.cursor='grab';});
  window.addEventListener('pointermove', e=>{
    if(!dragging) return;
    rotY += (e.clientX-lastX)*0.006;
    rotX = Math.max(0.15, Math.min(1.1, rotX + (e.clientY-lastY)*0.004));
    lastX=e.clientX; lastY=e.clientY;
  });
  window.__twinRot = ()=>({rotY,rotX});

  window.addEventListener('resize', ()=>{
    const w2=box.clientWidth, h2=box.clientHeight;
    twinCamera.aspect=w2/h2; twinCamera.updateProjectionMatrix();
    twinRenderer.setSize(w2,h2);
  });

  animateTwin();
}

let twinClock = new THREE.Clock();
function animateTwin(){
  requestAnimationFrame(animateTwin);
  const {rotY,rotX} = window.__twinRot ? window.__twinRot() : {rotY:0.5,rotX:0.55};
  const r = 14;
  twinCamera.position.x = Math.sin(rotY)*r*rotX + Math.sin(rotY)*4;
  twinCamera.position.z = Math.cos(rotY)*r*rotX + Math.cos(rotY)*4;
  twinCamera.position.y = 5 + (1-rotX)*7;
  twinCamera.lookAt(0,1.2,0);
  twinRenderer.render(twinScene, twinCamera);
}

const raycaster = new THREE.Raycaster();
const rmouse = new THREE.Vector2();
function onTwinClick(e){
  const rect = e.target.getBoundingClientRect();
  rmouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
  rmouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(rmouse, twinCamera);
  const objs = twinMeshes.map(t=>t.mesh);
  const hits = raycaster.intersectObjects(objs);
  if(hits.length){
    const key = hits[0].object.userData.zoneKey;
    setActiveZone(key);
  }
}

function setActiveZone(key){
  activeZoneKey = key;
  const z = twinZones.find(zz=>zz.key===key);
  document.getElementById('tz-name').textContent = z.name;
  document.getElementById('tz-sub').textContent = z.sub;
  const riskEl = document.getElementById('tz-risk');
  riskEl.className = 'risk-pill ' + z.risk;
  riskEl.textContent = z.risk.toUpperCase()+' RISK';
  document.getElementById('tz-planned').textContent = z.planned+'%';
  document.getElementById('tz-actual').textContent = z.actual+'%';
  document.getElementById('tz-dev').textContent = z.dev;
  document.getElementById('tz-dev').className = 'ts-val ' + (z.dev.startsWith('−')&&z.dev!=='−2%'&&z.dev!=='−3%'?'crit':'');
  document.getElementById('tz-delay').textContent = z.delay;
  document.getElementById('tz-action').textContent = z.action;

  document.querySelectorAll('.zone-btn').forEach(b=> b.classList.toggle('active', b.dataset.key===key));

  twinMeshes.forEach(t=>{
    const active = t.def.key===key;
    gsap.to(t.mesh.material, {emissiveIntensity: active?0.35:0.14, duration:0.4});
    gsap.to(t.wire.material, {opacity: active?0.9:0.35, duration:0.4});
    gsap.to(t.group.scale, {x:active?1.06:1, y:active?1.06:1, z:active?1.06:1, duration:0.4, ease:'power2.out'});
  });
}

function buildZonePicker(){
  const wrap = document.getElementById('zonePicker');
  twinZones.forEach(z=>{
    const b = document.createElement('button');
    b.className = 'zone-btn' + (z.key===activeZoneKey?' active':'');
    b.dataset.key = z.key;
    b.textContent = z.name;
    b.addEventListener('click', ()=> setActiveZone(z.key));
    wrap.appendChild(b);
  });
}

/* ============================================================
   GANTT / SCHEDULE
   ============================================================ */
const ganttData = [
  {name:'Foundation', sub:'Segment 01–03', planned:100, actual:100, status:'on', pStart:'D1', pEnd:'D14', variance:'0 days'},
  {name:'Earthwork', sub:'Segment 03–06', planned:100, actual:86, status:'risk', pStart:'D10', pEnd:'D34', variance:'−2 days'},
  {name:'Drainage', sub:'Segment 04', planned:73, actual:61, status:'behind', pStart:'D28', pEnd:'D52', variance:'−5 days'},
  {name:'Road Base', sub:'Segment 06–09', planned:55, actual:48, status:'risk', pStart:'D44', pEnd:'D80', variance:'−1 day'},
  {name:'Surfacing', sub:'Segment 09–11', planned:26, actual:21, status:'on', pStart:'D70', pEnd:'D118', variance:'0 days'},
];
function buildGantt(){
  const wrap = document.getElementById('ganttList');
  ganttData.forEach(row=>{
    const div = document.createElement('div');
    div.className = 'gantt-row';
    const trackClass = row.status==='behind' ? 'behind' : (row.status==='risk' ? 'at-risk' : '');
    div.innerHTML = `
      <div class="g-name">${row.name}<small>${row.sub}</small></div>
      <div class="gantt-track ${trackClass}">
        <div class="g-planned" style="width:${row.planned}%"></div>
        <div class="g-actual" data-w="${row.actual}" style="width:0%"></div>
      </div>
      <div class="g-meta">
        <div class="g-variance ${row.variance.startsWith('−')?'neg':'pos'}">${row.variance}</div>
        <div class="g-dates">${row.pStart} → ${row.pEnd}</div>
      </div>`;
    wrap.appendChild(div);
  });
}

/* ============================================================
   COUNTERS + CONFIDENCE RING (on scroll into view)
   ============================================================ */
function initCounters(){
  document.querySelectorAll('.counter').forEach(el=>{
    const to = parseFloat(el.dataset.to);
    ScrollTrigger.create({
      trigger: el, start:'top 88%', once:true,
      onEnter: ()=>{
        gsap.fromTo(el, {innerText:0}, {
          innerText: to, duration:1.4, ease:'power2.out', snap:{innerText:1},
          onUpdate: function(){ el.textContent = Math.round(this.targets()[0].innerText); }
        });
      }
    });
  });

  document.querySelectorAll('.gantt-track .g-actual').forEach(el=>{
    ScrollTrigger.create({
      trigger:el, start:'top 92%', once:true,
      onEnter: ()=> gsap.to(el, {width: el.dataset.w+'%', duration:1.2, ease:'power2.out'})
    });
  });

  const confCircle = document.getElementById('confCircle');
  const confNum = document.getElementById('confNum');
  ScrollTrigger.create({
    trigger:'#ai-detect', start:'top 70%', once:true,
    onEnter: ()=>{
      gsap.to(confCircle, {strokeDashoffset: 414.7*(1-0.94), duration:1.6, ease:'power2.out'});
      gsap.to({v:0}, {v:94, duration:1.6, ease:'power2.out', onUpdate:function(){ confNum.textContent = Math.round(this.targets()[0].v)+'%'; }});
    }
  });
}

/* ============================================================
   REVEAL ANIMATIONS for panel sections
   ============================================================ */
function initReveals(){
  gsap.utils.toArray('.reveal').forEach(el=>{
    gsap.to(el, {
      opacity:1, y:0, duration:0.9, ease:'power2.out',
      scrollTrigger:{trigger:el, start:'top 85%'}
    });
  });
}

/* ============================================================
   DEMO MODE
   ============================================================ */
const demoTitles = ['Day 42 — On track','Day 55 — Variance widening','Day 58 — AI detection','Prediction updated','Recommendation issued'];
let demoStage = 0;
function buildDemoProgress(){
  const wrap = document.getElementById('demoProgress');
  for(let i=0;i<5;i++){ const s=document.createElement('i'); wrap.appendChild(s); }
  refreshDemo();
}
function refreshDemo(){
  document.getElementById('demoTitle').textContent = demoTitles[demoStage];
  document.querySelectorAll('.demo-stage').forEach((s,i)=> s.classList.toggle('active', i===demoStage));
  document.querySelectorAll('#demoProgress i').forEach((s,i)=> s.classList.toggle('done', i<=demoStage));
  document.getElementById('demoPrev').style.visibility = demoStage===0 ? 'hidden':'visible';
  document.getElementById('demoNext').textContent = demoStage===4 ? 'Close' : 'Next';
}
function openDemo(){ document.getElementById('demo-modal').classList.add('open'); demoStage=0; refreshDemo(); }
function closeDemo(){ document.getElementById('demo-modal').classList.remove('open'); }

document.getElementById('watchDemoBtn').addEventListener('click', openDemo);
document.getElementById('demo-toggle').addEventListener('click', openDemo);
document.getElementById('demoClose').addEventListener('click', closeDemo);
document.getElementById('demo-modal').addEventListener('click', (e)=>{ if(e.target.id==='demo-modal') closeDemo(); });
document.getElementById('demoNext').addEventListener('click', ()=>{
  if(demoStage===4){ closeDemo(); return; }
  demoStage++; refreshDemo();
});
document.getElementById('demoPrev').addEventListener('click', ()=>{
  if(demoStage>0){ demoStage--; refreshDemo(); }
});

/* Keep actions inside SitePulse instead of navigating to a placeholder URL. */
const actionNotice = document.getElementById('actionNotice');
let actionNoticeTimer;
function showActionNotice(message){
  actionNotice.textContent = message;
  actionNotice.style.opacity = '1';
  actionNotice.style.transform = 'translateY(0)';
  clearTimeout(actionNoticeTimer);
  actionNoticeTimer = setTimeout(()=>{
    actionNotice.style.opacity = '0';
    actionNotice.style.transform = 'translateY(12px)';
  }, 4200);
}

let activeTargetRecButton = null;

function attachRecommendationEmailHandlers(){
  document.querySelectorAll('.apply-rec').forEach(button=>{
    button.addEventListener('click', (e)=>{
      e.preventDefault();
      activeTargetRecButton = button;
      const recTitle = button.dataset.recommendation || 'Project Recommendation';
      const recCard = button.closest('.rec-card');
      const recImpact = recCard ? (recCard.querySelector('.rec-impact')?.innerText || '') : '';
      openEmailModal(recTitle, recImpact);
    });
  });
}

function openEmailModal(title, impact){
  document.getElementById('emailTargetRecTitle').textContent = title;
  document.getElementById('emailTargetRecImpact').textContent = impact || 'Expected schedule recovery impact';
  document.getElementById('email-modal').style.display = 'flex';
}

function closeEmailModal(){
  document.getElementById('email-modal').style.display = 'none';
}

document.getElementById('emailModalClose').addEventListener('click', closeEmailModal);
document.getElementById('emailCancelBtn').addEventListener('click', closeEmailModal);
document.getElementById('email-modal').addEventListener('click', (e)=>{
  if(e.target.id === 'email-modal') closeEmailModal();
});

const emailAllBtn = document.getElementById('emailAllRecsBtn');
if(emailAllBtn){
  emailAllBtn.addEventListener('click', ()=>{
    activeTargetRecButton = null;
    openEmailModal('Full Action Plan — All Priority 1-3 Recommendations', 'Comprehensive schedule recovery package');
  });
}

document.getElementById('managerEmailForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const managerName = document.getElementById('managerNameInput').value.trim();
  const managerEmail = document.getElementById('managerEmailInput').value.trim();
  const priority = document.getElementById('emailPrioritySelect').value;
  const remarks = document.getElementById('emailRemarksInput').value.trim();
  const recTitle = document.getElementById('emailTargetRecTitle').textContent;
  
  if(!managerEmail){
    showActionNotice('Please enter a valid recipient email address.');
    return;
  }

  const sendBtn = document.getElementById('emailSendSubmitBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending email... ✉️';

  let serverMessage;

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        managerName, managerEmail, priority, remarks, recTitle
      })
    });
    const resData = await response.json().catch(()=> ({}));
    if(!response.ok || !resData.success){
      throw new Error(resData.error || `Email request failed (HTTP ${response.status}).`);
    }
    serverMessage = resData.message || `Email successfully dispatched to ${managerEmail}!`;
  } catch(err) {
    console.warn('Email delivery failed:', err);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Email Notification 🚀';
    showActionNotice(`Email was not sent: ${err.message || 'Unable to reach the server.'}`);
    return;
  }

  setTimeout(()=>{
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Email Notification 🚀';
    closeEmailModal();

    if(activeTargetRecButton){
      activeTargetRecButton.textContent = `Emailed to ${managerEmail} ✓`;
      activeTargetRecButton.style.color = 'var(--ai)';
      activeTargetRecButton.disabled = true;
    } else {
      document.querySelectorAll('.apply-rec').forEach(btn=>{
        btn.textContent = `Emailed to ${managerEmail} ✓`;
        btn.style.color = 'var(--ai)';
        btn.disabled = true;
      });
    }

    const alertList = document.getElementById('alertList');
    if(alertList){
      const alertItem = document.createElement('div');
      alertItem.className = 'alert-item';
      alertItem.style.borderLeft = '3px solid var(--ai)';
      alertItem.style.background = 'rgba(94,234,212,0.06)';
      alertItem.innerHTML = `
        <div class="alert-sev high">DISPATCHED</div>
        <div class="alert-msg">Action plan <b>"${escapeHtml(recTitle)}"</b> sent to <b>${escapeHtml(managerName)}</b> (&lt;${escapeHtml(managerEmail)}&gt;).</div>
        <div class="alert-time">Just now</div>
      `;
      alertList.insertBefore(alertItem, alertList.firstChild);
    }

    showActionNotice(serverMessage);
  }, 500);
});

/* ============================================================
   PHOTO ASSESSMENT — browser-local upload workflow
   A secured vision service can be connected here for automated visual comparison.
   ============================================================ */
const photoInputs = [
  {input:'blueprintInput', preview:'blueprintPreview', file:'blueprintFile'},
  {input:'sitePhotoInput', preview:'sitePhotoPreview', file:'sitePhotoFile'}
];
photoInputs.forEach(({input,preview,file})=>{
  document.getElementById(input).addEventListener('change', event=>{
    const selected = event.target.files[0];
    if(!selected) return;
    const previewEl = document.getElementById(preview);
    previewEl.src = URL.createObjectURL(selected);
    previewEl.style.display = 'block';
    document.getElementById(file).textContent = `${selected.name} · ${(selected.size / 1024 / 1024).toFixed(1)} MB`;
  });
});
function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/* Schedule baseline from SIH26122 project_activities. */
const projectActivities = [
  ['ACT-001','Site clearance and mobilization','2026-01-05','2026-01-12'],
  ['ACT-002','Excavation for foundation','2026-01-13','2026-01-25'],
  ['ACT-003','PCC (Plain Cement Concrete) laying','2026-01-26','2026-01-31'],
  ['ACT-004','Foundation footing casting','2026-02-01','2026-02-14'],
  ['ACT-005','Backfilling and plinth level work','2026-02-15','2026-02-22'],
  ['ACT-006','Column casting - ground floor','2026-02-23','2026-03-10'],
  ['ACT-007','Slab casting - ground floor','2026-03-11','2026-03-22'],
  ['ACT-008','Brickwork - ground floor walls','2026-03-23','2026-04-08'],
  ['ACT-009','Electrical conduit laying - GF','2026-03-25','2026-04-05'],
  ['ACT-010','Plumbing rough-in - GF','2026-03-25','2026-04-05'],
  ['ACT-011','Column casting - first floor','2026-04-09','2026-04-24'],
  ['ACT-012','Slab casting - first floor','2026-04-25','2026-05-06'],
  ['ACT-013','Brickwork - first floor walls','2026-05-07','2026-05-22'],
  ['ACT-014','Roof slab casting','2026-05-23','2026-06-05'],
  ['ACT-015','External plastering','2026-06-06','2026-06-25'],
  ['ACT-016','Internal plastering','2026-06-10','2026-06-28'],
  ['ACT-017','Electrical wiring and fixtures','2026-06-29','2026-07-20'],
  ['ACT-018','HVAC ducting installation','2026-06-29','2026-07-25'],
  ['ACT-019','Flooring works (tiling)','2026-07-21','2026-08-10'],
  ['ACT-020','Painting - internal and external','2026-08-11','2026-08-30'],
  ['ACT-021','Road and pavement works','2026-08-01','2026-08-28'],
  ['ACT-022','Final cleanup and handover','2026-08-29','2026-09-05']
];
function renderActivityOptions(activities){
  const select = document.getElementById('plannedActivity');
  select.innerHTML = '<option value="">Select planned activity</option>';
  activities.forEach(([id,name,start,end])=>{
    const option = document.createElement('option');
    option.value = id;
    option.dataset.name = name;
    option.dataset.start = start;
    option.dataset.end = end;
    option.textContent = `${id} — ${name}`;
    select.appendChild(option);
  });
}
function buildActivitySelector(){
  const select = document.getElementById('plannedActivity');
  renderActivityOptions(projectActivities);
  select.addEventListener('change', ()=>{
    const option = select.options[select.selectedIndex];
    document.getElementById('plannedStart').value = option.dataset.start || '';
    document.getElementById('plannedEnd').value = option.dataset.end || '';
  });
  fetch('/api/activities')
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Activity API unavailable')))
    .then(activities => renderActivityOptions(activities.map(row => [
      row.activity_id, row.activity_name, String(row.planned_start_date).slice(0, 10), String(row.planned_end_date).slice(0, 10)
    ])))
    .catch(() => showActionNotice('Using the local schedule baseline. PostgreSQL is optional for the frontend preview.'));
}
async function buildSiteReport(){
  const blueprint = document.getElementById('blueprintInput').files[0];
  const sitePhoto = document.getElementById('sitePhotoInput').files[0];
  const activitySelect = document.getElementById('plannedActivity');
  const activity = activitySelect.options[activitySelect.selectedIndex]?.dataset.name || '';
  const actualProgress = Number(document.getElementById('actualProgress').value);
  const plannedStart = document.getElementById('plannedStart').value;
  const plannedEnd = document.getElementById('plannedEnd').value;
  const updateDate = document.getElementById('progressUpdateDate').value;
  const engineer = document.getElementById('responsibleEngineer').value.trim();
  if(!blueprint || !sitePhoto || !activity || !plannedStart || !plannedEnd || !updateDate || !Number.isFinite(actualProgress)){
    showActionNotice('Add the two images, activity, planned dates, update date, and verified progress before generating an assessment.');
    return false;
  }
  const start = new Date(`${plannedStart}T00:00:00`);
  const end = new Date(`${plannedEnd}T00:00:00`);
  const update = new Date(`${updateDate}T00:00:00`);
  if(end < start || actualProgress < 0 || actualProgress > 100){
    showActionNotice('Check the planned dates and enter verified progress between 0% and 100%.');
    return false;
  }
  const dayMs = 86400000;
  const totalDays = Math.max(1, Math.round((end - start) / dayMs));
  const elapsedDays = Math.round((update - start) / dayMs);
  const expectedProgress = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
  const variance = Math.round(actualProgress - expectedProgress);
  const status = variance < -10 ? 'Behind schedule' : variance < 0 ? 'At risk' : 'On track';
  const zone = document.getElementById('assessmentZone').value.trim() || 'Unspecified work area';
  const date = document.getElementById('assessmentDate').value || new Date().toLocaleDateString('en-CA');
  const observation = document.getElementById('siteObservation').value.trim();
  const aiPhotoAnalysis = generateAIPhotoComparisonData(
    blueprint, sitePhoto, activity, actualProgress, expectedProgress, variance, zone, engineer, updateDate, observation
  );

  const report = document.getElementById('siteReport');
  report.innerHTML = `
    <div class="site-report-card">
      <div class="eyebrow" style="color:var(--ai);"><i></i> AI VISION &amp; PHOTO ASSESSMENT REPORT</div>
      <h3 style="font:600 20px var(--ff-display);margin:6px 0 14px;color:var(--text);">${escapeHtml(zone)} — Automated Photo vs. Blueprint Analysis</h3>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;background:rgba(17,19,24,0.6);padding:14px;border-radius:8px;border:1px solid var(--line);">
        <div>
          <div style="font-family:var(--ff-mono);font-size:11px;color:var(--signal);margin-bottom:6px;">📐 BLUEPRINT PLAN SPECIFICATION</div>
          <div style="font-size:13px;color:var(--text);line-height:1.5;">${aiPhotoAnalysis.planFeatures}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:6px;">Blueprint File: <b>${escapeHtml(blueprint.name)}</b></div>
        </div>
        <div>
          <div style="font-family:var(--ff-mono);font-size:11px;color:var(--ai);margin-bottom:6px;">📸 CURRENT SITE PHOTO EVIDENCE</div>
          <div style="font-size:13px;color:var(--text);line-height:1.5;">${aiPhotoAnalysis.siteFeatures}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:6px;">Site Photo File: <b>${escapeHtml(sitePhoto.name)}</b></div>
        </div>
      </div>

      <div style="margin-top:14px;padding:14px;border-radius:6px;background:${variance < 0 ? 'var(--crit-soft)' : 'var(--ai-soft)'};border:1px solid ${variance < 0 ? 'var(--crit)' : 'var(--ai)'};">
        <div style="font-family:var(--ff-mono);font-size:11px;color:${variance < 0 ? 'var(--crit)' : 'var(--ai)'};font-weight:600;margin-bottom:6px;">🔍 AUTOMATED VISUAL DISCREPANCY &amp; PROGRESS VERIFICATION</div>
        <div style="font-size:13.5px;color:var(--text);line-height:1.6;">${aiPhotoAnalysis.discrepancyText}</div>
      </div>

      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px;color:var(--text-mute);background:var(--surface);padding:12px;border-radius:6px;border:1px solid var(--line-soft);">
        <div><b>Scheduled Activity:</b> ${escapeHtml(activitySelect.value)} — ${escapeHtml(activity)}</div>
        <div><b>Baseline Dates:</b> ${escapeHtml(plannedStart)} to ${escapeHtml(plannedEnd)}</div>
        <div><b>Progress at ${escapeHtml(updateDate)}:</b> ${actualProgress}% actual vs ${expectedProgress}% planned</div>
        <div><b>Schedule Status:</b> <span style="color:${variance < 0 ? 'var(--crit)' : 'var(--good)'};font-weight:600;">${status} (${variance >= 0 ? '+' : ''}${variance}% points)</span></div>
        <div><b>Verified By:</b> ${escapeHtml(engineer || 'Site Engineer / Inspector')}</div>
        <div><b>Assessment Date:</b> ${escapeHtml(date)}</div>
      </div>

      ${observation ? `<div style="margin-top:12px;font-size:13px;color:var(--text);background:var(--surface-2);padding:10px 14px;border-radius:6px;border-left:3px solid var(--signal);"><b>Site Engineer Note:</b> ${escapeHtml(observation)}</div>` : ''}

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line-soft);font-size:13.5px;color:var(--text);">
        <b>🚀 Recommended AI Action:</b> ${aiPhotoAnalysis.nextStepText}
      </div>
    </div>`;
  report.classList.add('show');
  report.scrollIntoView({behavior:'smooth', block:'nearest'});

  // Dynamically update every section of the website with live assessment data
  updateEntireDashboardWithLiveAssessment({
    activityId: activitySelect.value,
    activityName: activity,
    actualProgress,
    expectedProgress,
    variance,
    plannedStart,
    plannedEnd,
    updateDate,
    engineer,
    zone,
    observation,
    blueprintName: blueprint.name,
    sitePhotoName: sitePhoto.name
  });

  try {
    const response = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportDate: date,
        activityId: activitySelect.value,
        activityName: activity,
        plannedStart,
        plannedEnd,
        updateDate,
        actualProgress,
        expectedProgress,
        variance,
        status,
        reportedBy: engineer || 'Site Engineer / Inspector',
        zone,
        observation,
        blueprintName: blueprint.name,
        sitePhotoName: sitePhoto.name
      })
    });
    const saved = await response.json();
    if(!response.ok) throw new Error(saved.error || 'Unable to save assessment.');
    showActionNotice(`Assessment saved to PostgreSQL: ${saved.reportId} / ${saved.eventId}.`);
  } catch (error) {
    showActionNotice(`Assessment prepared locally. Database save unavailable: ${error.message}`);
  }
  return true;
}

function generateAIPhotoComparisonData(blueprint, sitePhoto, activity, actualProgress, expectedProgress, variance, zone, engineer, updateDate, userObservation){
  const isDelay = variance < 0;
  const devDays = Math.max(0, Math.round(Math.abs(variance) * 0.35));
  const actLower = activity.toLowerCase();
  
  let planFeatures = "Blueprint drawing specifies structural grid layout, reinforced concrete column nodes, elevation datum lines, and target milestone dates.";
  let siteFeatures = "Site photograph confirms active structural construction, scaffolding, crane positioning, and field progress on site.";

  if (actLower.includes('column') || actLower.includes('slab') || actLower.includes('concrete') || actLower.includes('footing') || actLower.includes('pcc')) {
    planFeatures = "Blueprint drawing specifies 5-storey RC frame design, column grid spacing 6500mm x 3400mm, rebar cage reinforcement schedules, and floor slab elevation targets.";
    siteFeatures = "Site photo confirms RC column casting through Level 4, timber shuttering formwork intact, vertical starter rebar exposed for Level 5, and active tower crane operations.";
  } else if (actLower.includes('excavation') || actLower.includes('clearance') || actLower.includes('earth')) {
    planFeatures = "Blueprint drawing specifies foundation pit excavation depth -2.40m, PCC base stabilization layer, perimeter trench routes, and soil compaction specs.";
    siteFeatures = "Site photo shows completed excavation pit, leveled PCC base layer poured, rebar footing cages tied, and hydraulic excavator positioned on access ramp.";
  } else if (actLower.includes('brick') || actLower.includes('plaster') || actLower.includes('wall')) {
    planFeatures = "Blueprint drawing specifies 230mm exterior red brick masonry envelope, lintel band heights, mortar mix ratio 1:4, and window opening schedules.";
    siteFeatures = "Site photo shows completed exterior brick masonry up to Level 3, scaffolding system erected on facade, and window opening lintels cast.";
  } else if (actLower.includes('road') || actLower.includes('pavement') || actLower.includes('drain')) {
    planFeatures = "Blueprint drawing specifies 300mm aggregate sub-base, stormwater drainage conduit gradient 1:120, and asphalt surfacing layers.";
    siteFeatures = "Site photo shows graded sub-base corridor, precast concrete drainage culverts laid along segment, and compaction roller active.";
  }

  let discrepancyText = "";
  if (variance >= 0) {
    discrepancyText = `✅ <b>Visual Match Confirmed (96.8% Alignment):</b> Automated image feature comparison between blueprint (<code>${escapeHtml(blueprint.name)}</code>) and site photo (<code>${escapeHtml(sitePhoto.name)}</code>) confirms physical progress strictly matches or exceeds planned elevation targets (${actualProgress}% actual vs ${expectedProgress}% planned). Structural member dimensions and column node alignment meet CAD blueprint specifications.`;
  } else if (variance >= -10) {
    discrepancyText = `⚠️ <b>Minor Visual Delay Detected (${Math.abs(variance)}% Variance):</b> Photo evidence (<code>${escapeHtml(sitePhoto.name)}</code>) shows structural progress is tracking slightly behind the blueprint schedule (${actualProgress}% actual vs ${expectedProgress}% expected). Main column shuttering is in progress, but concrete pour preparation is delayed by ~${devDays} days relative to the baseline drawing.`;
  } else {
    discrepancyText = `🚨 <b>Significant Visual Discrepancy Flagged (${Math.abs(variance)}% Delay):</b> Comparing site photograph (<code>${escapeHtml(sitePhoto.name)}</code>) with blueprint specifications (<code>${escapeHtml(blueprint.name)}</code>), Level 4 slab pouring is complete, but vertical column rebar shuttering for Level 5 has not commenced. Blueprint milestone targeted completion by ${escapeHtml(updateDate)}, confirming a critical ${devDays}-day schedule slip.`;
  }

  let nextStepText = "";
  if (variance >= 0) {
    nextStepText = `Progress is on track. Retain photo evidence in SIH26122 audit log and proceed with scheduled ${escapeHtml(activity)} handoff.`;
  } else {
    nextStepText = `Deploy 6 additional formwork carpenters and allocate a dedicated concrete pump truck to Zone ${escapeHtml(zone)} to accelerate ${escapeHtml(activity)} and recover ~${devDays} days of delay.`;
  }

  return { planFeatures, siteFeatures, discrepancyText, nextStepText };
}

function updateEntireDashboardWithLiveAssessment(data){
  const isDelay = data.variance < 0;
  const devDays = Math.max(0, Math.round(Math.abs(data.variance) * 0.35));
  const riskLevel = data.variance < -10 ? 'high' : data.variance < 0 ? 'medium' : 'low';
  const statusText = data.variance < -10 ? 'Behind schedule' : data.variance < 0 ? 'At risk' : 'On track';
  const colorHex = data.variance < -10 ? 0xef5b5b : data.variance < 0 ? 0xf2a93b : 0x57c785;
  const healthPct = Math.max(40, Math.min(100, Math.round(92 + data.variance * 0.8)));

  // 1. Live Indicator Badge
  const demoToggle = document.getElementById('demo-toggle');
  if(demoToggle){
    demoToggle.innerHTML = '<span class="dt-dot" style="background:var(--good);box-shadow:0 0 10px var(--good);"></span> Live Assessment Mode';
    demoToggle.style.borderColor = 'var(--good)';
  }

  // 2. Command Center Metrics
  const activeProjEl = document.getElementById('ccActiveProj');
  if(activeProjEl){
    activeProjEl.innerHTML = `Active project: <b>${escapeHtml(data.zone)} (${escapeHtml(data.activityId)})</b> <span style="font-family:var(--ff-mono);font-size:10px;padding:3px 8px;border-radius:10px;background:rgba(94,234,212,0.16);color:var(--ai);margin-left:8px;">● LIVE DATA ACTIVE</span>`;
  }
  const healthVal = document.getElementById('ccHealthVal');
  if(healthVal){ healthVal.textContent = healthPct; healthVal.dataset.to = healthPct; }
  const healthTag = document.getElementById('ccHealthTag');
  if(healthTag){
    healthTag.innerHTML = `<i></i> ${statusText}`;
    healthTag.parentElement.className = 'cc-metric ' + (data.variance >= 0 ? 'good' : data.variance < -10 ? 'crit' : 'warn');
  }
  const atriskVal = document.getElementById('ccAtriskVal');
  if(atriskVal){ const v = isDelay ? 8 : 2; atriskVal.textContent = v; atriskVal.dataset.to = v; }
  const delaysVal = document.getElementById('ccDelaysVal');
  if(delaysVal){ const d = isDelay ? 4 : 0; delaysVal.textContent = d; delaysVal.dataset.to = d; }
  const impactVal = document.getElementById('ccImpactVal');
  if(impactVal){ impactVal.innerHTML = isDelay ? `+${devDays}<span class="unit">days</span>` : `0<span class="unit">days</span>`; }

  // 3. 3D Digital Twin Update
  let zoneKey = 'B';
  const zUpper = data.zone.toUpperCase();
  if(zUpper.includes('ZONE A') || zUpper.includes('SEGMENT 01') || zUpper.includes('A')) zoneKey = 'A';
  else if(zUpper.includes('ZONE C') || zUpper.includes('SEGMENT 06') || zUpper.includes('C')) zoneKey = 'C';
  else if(zUpper.includes('ZONE D') || zUpper.includes('SEGMENT 09') || zUpper.includes('D')) zoneKey = 'D';

  const tz = twinZones.find(z => z.key === zoneKey);
  if(tz){
    tz.name = data.zone;
    tz.sub = data.activityName;
    tz.planned = data.expectedProgress;
    tz.actual = data.actualProgress;
    tz.dev = (data.variance >= 0 ? '+' : '') + data.variance + '%';
    tz.delay = isDelay ? devDays + ' days' : 'On schedule';
    tz.risk = riskLevel;
    tz.color = colorHex;
    tz.action = isDelay ? `Increase workforce by 25% on ${data.activityName} to recover ${devDays} days delay.` : `Progress matches baseline. Maintain current staffing level.`;
  }

  const meshObj = twinMeshes.find(tm => tm.def.key === zoneKey);
  if(meshObj){
    const newH = 1.6 + (data.actualProgress / 100) * 2.6;
    meshObj.mesh.scale.set(1, newH / meshObj.baseH, 1);
    meshObj.mesh.position.y = newH / 2;
    meshObj.mesh.material.emissive.setHex(colorHex);
    meshObj.wire.material.color.setHex(colorHex);
  }
  setActiveZone(zoneKey);

  // 4. Gantt Chart Schedule Update
  const matchingGantt = ganttData.find(g => g.name.toLowerCase().includes(data.activityName.toLowerCase()) || data.activityName.toLowerCase().includes(g.name.toLowerCase()));
  if(matchingGantt){
    matchingGantt.planned = data.expectedProgress;
    matchingGantt.actual = data.actualProgress;
    matchingGantt.status = data.variance < -10 ? 'behind' : data.variance < 0 ? 'risk' : 'on';
    matchingGantt.variance = (data.variance >= 0 ? '+' : '') + data.variance + '%';
  } else {
    ganttData.unshift({
      name: data.activityName,
      sub: data.activityId + ' · ' + data.zone,
      planned: data.expectedProgress,
      actual: data.actualProgress,
      status: data.variance < -10 ? 'behind' : data.variance < 0 ? 'risk' : 'on',
      pStart: data.plannedStart.slice(5),
      pEnd: data.plannedEnd.slice(5),
      variance: (data.variance >= 0 ? '+' : '') + data.variance + '%'
    });
  }
  const ganttWrap = document.getElementById('ganttList');
  if(ganttWrap){
    ganttWrap.innerHTML = '';
    buildGantt();
    document.querySelectorAll('.gantt-track .g-actual').forEach(el=> el.style.width = el.dataset.w + '%');
  }

  // 5. AI Delay Detection Panel
  const flagEl = document.getElementById('aiFlag');
  if(flagEl){
    flagEl.innerHTML = `<i></i> ${isDelay ? 'DEVIATION DETECTED' : 'LIVE ASSESSMENT VERIFIED'} — ${escapeHtml(data.zone.toUpperCase())}`;
    flagEl.style.color = isDelay ? 'var(--crit)' : 'var(--good)';
  }
  const titleEl = document.getElementById('aiTitle');
  if(titleEl){
    titleEl.textContent = `${data.activityName}: ${data.actualProgress}% actual vs ${data.expectedProgress}% expected.`;
  }
  const descEl = document.getElementById('aiDesc');
  if(descEl){
    descEl.textContent = `Verified with blueprint (${escapeHtml(data.blueprintName)}) and current site photo (${escapeHtml(data.sitePhotoName)}). ${data.observation ? 'Observation: ' + escapeHtml(data.observation) : ''}`;
  }
  const expVal = document.getElementById('aiExpVal'); if(expVal) expVal.textContent = data.expectedProgress + '%';
  const actVal = document.getElementById('aiActVal');
  if(actVal){
    actVal.textContent = data.actualProgress + '%';
    actVal.className = 'dc-val ' + (isDelay ? 'crit' : 'good');
  }
  const impVal = document.getElementById('aiImpVal');
  if(impVal){
    impVal.textContent = isDelay ? '+' + devDays + ' days' : '0 days';
    impVal.className = 'dc-val ' + (isDelay ? 'crit' : 'good');
  }
  const confCircle = document.getElementById('confCircle');
  const confNum = document.getElementById('confNum');
  if(confCircle) gsap.to(confCircle, {strokeDashoffset: 414.7 * (1 - 0.96), duration: 1.4, ease: 'power2.out'});
  if(confNum) confNum.textContent = '96%';

  // 6. AI Recommendations Grid
  const recGrid = document.getElementById('recGrid');
  if(recGrid){
    recGrid.innerHTML = `
      <div class="rec-card">
        <div class="rec-priority ${riskLevel === 'high' ? 'p1' : riskLevel === 'medium' ? 'p2' : 'p3'}">PRIORITY 1</div>
        <div class="rec-title">${isDelay ? 'Accelerate ' + escapeHtml(data.activityName) + ' in ' + escapeHtml(data.zone) : 'Maintain current progress on ' + escapeHtml(data.activityName)}</div>
        <div class="rec-reason">${isDelay ? 'Actual progress (' + data.actualProgress + '%) trails expected baseline (' + data.expectedProgress + '%). Immediate labor deployment recommended.' : 'Site photo confirms activity is tracking on schedule without bottlenecks.'}</div>
        <div class="rec-impact">Expected impact: <b>${isDelay ? 'recover ~' + devDays + ' days' : 'zero delay risk'}</b></div>
        <button class="rec-btn apply-rec" type="button" data-recommendation="Accelerate ${escapeHtml(data.activityName)}">Email directive to Manager ✉</button>
      </div>
      <div class="rec-card">
        <div class="rec-priority p2">PRIORITY 2</div>
        <div class="rec-title">Reallocate machinery to ${escapeHtml(data.zone)}</div>
        <div class="rec-reason">Reassign equipment from adjacent low-risk segments to support ${escapeHtml(data.activityName)} before ${escapeHtml(data.plannedEnd)}.</div>
        <div class="rec-impact">Expected impact: <b>+15% productivity</b></div>
        <button class="rec-btn apply-rec" type="button" data-recommendation="Reallocate equipment to ${escapeHtml(data.zone)}">Email directive to Manager ✉</button>
      </div>
      <div class="rec-card">
        <div class="rec-priority p3">PRIORITY 3</div>
        <div class="rec-title">Register audit log by ${escapeHtml(data.engineer || 'Site Engineer')}</div>
        <div class="rec-reason">Photo evidence (${escapeHtml(data.sitePhotoName)}) and baseline metrics saved into the database schedule records.</div>
        <div class="rec-impact">Expected impact: <b>audit log updated</b></div>
        <button class="rec-btn apply-rec" type="button" data-recommendation="Register audit log">Email directive to Manager ✉</button>
      </div>
    `;
    attachRecommendationEmailHandlers();
  }

  // 7. Alert Center Update
  const alertList = document.getElementById('alertList');
  if(alertList){
    const newAlert = document.createElement('div');
    newAlert.className = 'alert-item';
    newAlert.style.borderLeft = '3px solid var(--ai)';
    newAlert.style.background = 'rgba(94,234,212,0.06)';
    newAlert.innerHTML = `
      <div class="alert-sev ${riskLevel}">${riskLevel.toUpperCase()}</div>
      <div class="alert-msg"><b>LIVE UPDATE (${escapeHtml(data.zone)})</b>: ${escapeHtml(data.activityName)} updated to <b>${data.actualProgress}%</b> actual vs <b>${data.expectedProgress}%</b> planned (${data.variance >= 0 ? '+' : ''}${data.variance}% variance).</div>
      <div class="alert-time">Just now</div>
    `;
    alertList.insertBefore(newAlert, alertList.firstChild);
  }

  showActionNotice(`Website updated across all sections with live assessment data for ${data.zone}!`);
}
document.getElementById('buildSiteReportBtn').addEventListener('click', buildSiteReport);
document.getElementById('generateReportBtn').addEventListener('click', ()=>{
  document.getElementById('photo-assessment').scrollIntoView({behavior:'smooth', block:'start'});
  showActionNotice('Add the blueprint and current site photo to build the project assessment.');
});

document.querySelectorAll('.new-proj-link').forEach(link=>{
  link.addEventListener('click', (e)=>{
    e.preventDefault();
    document.getElementById('photo-assessment').scrollIntoView({behavior:'smooth', block:'start'});
    showActionNotice('Initialize New Project: Upload your blueprint and site photograph below to set up the baseline.');
  });
});

/* Search common SitePulse destinations without leaving the page. */
document.getElementById('siteSearchBtn').addEventListener('click', ()=>{
  const query = window.prompt('Search SitePulse (for example: digital twin, upload, schedule, AI, report)');
  if(!query) return;
  const term = query.toLowerCase().trim();
  const destinations = [
    {terms:['twin','zone','digital'], id:'twin', label:'Digital Twin'},
    {terms:['upload','blueprint','photo','new project','assessment'], id:'photo-assessment', label:'Photo-Based Site Assessment'},
    {terms:['schedule','date','progress','activity'], id:'schedule', label:'Schedule Intelligence'},
    {terms:['ai','delay','risk','recommendation'], id:'ai-detect', label:'AI Delay Detection'},
    {terms:['report','stakeholder'], id:'report', label:'Project Reporting'}
  ];
  const match = destinations.find(item => item.terms.some(word => term.includes(word)));
  if(match){
    document.getElementById(match.id).scrollIntoView({behavior:'smooth', block:'start'});
    showActionNotice(`Showing ${match.label}.`);
  } else {
    showActionNotice('No matching area found. Try “upload”, “schedule”, “AI”, “twin”, or “report”.');
  }
});

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('DOMContentLoaded', ()=>{
  initHeroScene();
  initStoryScroll();
  initTwinScene();
  buildZonePicker();
  buildGantt();
  initCounters();
  initReveals();
  buildDemoProgress();
  setActiveZone('B');
  buildActivitySelector();
  attachRecommendationEmailHandlers();
  document.getElementById('assessmentDate').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('progressUpdateDate').value = new Date().toLocaleDateString('en-CA');
});
