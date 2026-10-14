(function(){
'use strict';
class WareTraining{
  constructor(engine,ui){this.e=engine;this.ui=ui;this.state=this.load();this.manualQuizPassed=false;this.atHeight=false;this.duel=null;this.hazardIds=[];this.dropZone={x:-11,z:-4,r:3.2};this._build();this._applySaved();this._wire();this.sync();}
  defaults(){return{score:0,hazards:[],manualDelivered:0,harness:false,heightPlan:false,heightDone:false,whyDone:false,cyberDone:false,unsafeDone:false,unsafeActs:[],briefed:false,moduleDone:{manual:false,height:false,hazards:false,unsafe:false,why:false,cyber:false},highScores:[]}}
  load(){try{return{...this.defaults(),...JSON.parse(localStorage.getItem('warewiseXRState')||'{}')}}catch(_){return this.defaults()}}
  save(){try{localStorage.setItem('warewiseXRState',JSON.stringify(this.state))}catch(_){}window.WareWiseBackend?.syncProgress?.(this.state);this.ui.homeProgress?.(this.state)}
  reset(){this.resetSession()}
  resetSession(){
    clearInterval(this.duelTimer);
    this.state=this.defaults();this.manualQuizPassed=false;this.atHeight=false;this.duel=null;this.hazardIds=[];
    try{localStorage.removeItem('warewiseXRState')}catch(_){}
    this.e.carried=null;this._build();this._applySaved();
    this.e.camera.position=[0,1.68,13];this.e.camera.yaw=0;this.e.camera.pitch=0;
    this.ui.carry?.(null);this.ui.ppe?.(false);this.ui.closeModal?.();
    this.save();this.sync();
    this.ui.setObjective('Report to the briefing terminal','Follow the map, station signs and objective arrow to the blue briefing terminal, then press E.',.03);
    this.ui.toast('Warehouse restored • ready for a new trainee');
  }
  score(n,msg){this.state.score=Math.max(0,this.state.score+n);this.ui.toast(`${n>=0?'+':''}${n} • ${msg}`);this.save();this.sync()}
  sync(){this.ui.updateHUD?.(this.state);this.ui.homeProgress?.(this.state)}
  box(id,label,p,s,c,extra={}){return this.e.add({id,label,position:p,size:s,color:c,...extra})}
  _build(){const e=this.e;e.clear();
    // envelope
    this.box('floor','Warehouse floor',[0,-.15,-12],[40,.3,54],'#7b8794');
    this.box('wallL','West wall',[-20,4,-12],[.35,8,54],'#b4bec7',{solid:true});this.box('wallR','East wall',[20,4,-12],[.35,8,54],'#b4bec7',{solid:true});this.box('wallN','North wall',[0,4,-39],[40,8,.35],'#c3cbd2',{solid:true});this.box('wallS1','South wall',[-12,4,15],[16,8,.35],'#c3cbd2',{solid:true});this.box('wallS2','South wall',[12,4,15],[16,8,.35],'#c3cbd2',{solid:true});
    for(let z=12;z>-38;z-=5){this.box('line'+z,'Aisle line',[0,.02,z],[.12,.03,2.5],'#e2c94b');}
    for(let x=-18;x<=18;x+=6){this.box('beam'+x,'Roof beam',[x,7.6,-12],[.18,.22,53],'#7b8794');}
    // racks
    const rackXs=[-15,-6,6,15],rackZs=[-12,-27];let ri=0;for(const x of rackXs)for(const z of rackZs){ri++;this.rack(`rack${ri}`,x,z)}
    // signs / zones
    // loading bays, pedestrian lanes and visual safety furniture
    for(const x of [-13,-7,7,13]){this.box('dockDoor'+x,'Loading dock shutter',[x,2.6,-38.75],[5,5.1,.18],'#8c9ba5');this.box('dockHeader'+x,'Dock header',[x,5.35,-38.6],[5.2,.35,.4],'#485563')}
    for(let z=11;z>-36;z-=3){this.box('pedL'+z,'Pedestrian lane',[-18.25,.025,z],[.12,.035,1.7],'#58a7d2');this.box('pedR'+z,'Pedestrian lane',[-15.9,.025,z],[.12,.035,1.7],'#58a7d2')}
    for(let z=9;z>-34;z-=7){this.box('bollardL'+z,'Safety bollard',[-15.8,.65,z],[.22,1.3,.22],'#f6b900',{solid:true});this.box('bollardR'+z,'Safety bollard',[-18.35,.65,z],[.22,1.3,.22],'#f6b900',{solid:true})}
    for(let z=10;z>-36;z-=8){for(const x of [-10,0,10])this.box('light'+x+z,'Overhead light',[x,7.35,z],[3.6,.08,.35],'#d7eef5',{glow:true})}
    // Dedicated training/control room in the south-east corner keeps electronic terminals
    // out of material-handling routes. The perimeter warehouse walls form two room sides.
    this.box('controlRoomFloor','Training control room floor',[14.7,.015,10.1],[9.4,.035,8.9],'#5a6b78');
    this.box('controlRoomBackWall','Training room wall',[14.7,2.25,5.55],[10.0,4.5,.28],'#98a5af',{solid:true});
    this.box('controlRoomWestWallA','Training room wall',[9.72,2.25,8.15],[.28,4.5,5.2],'#98a5af',{solid:true});
    this.box('controlRoomWestWallB','Training room wall',[9.72,2.25,14.55],[.28,4.5,.5],'#98a5af',{solid:true});
    this.box('controlRoomDoorPost','Training room doorway',[9.72,1.15,10.95],[.34,2.3,.34],'#6f7d86',{solid:true});
    this.box('controlRoomDoorHeader','Training room doorway header',[9.72,3.65,12.35],[.34,.35,3.1],'#6f7d86');
    this.box('controlRoomMarker','Training Control Room',[9.95,1.2,12.35],[.05,.05,.05],'#9fd4ee',{visible:false});

    // Four electronic terminals are grouped safely inside the control room and face north
    // into the room, away from warehouse traffic and movable loads.
    this.box('briefTerminal','Briefing terminal',[11.15,1.05,13.55],[1.25,1.9,.65],'#2c89b8',{solid:true,interactive:true,kind:'terminal'});this.box('briefScreen','Briefing screen',[11.15,1.25,13.21],[.88,.66,.04],'#68c7ff');
    this.box('cyberTerminal','Cyber awareness terminal',[13.55,1.15,13.55],[1.35,2.3,.8],'#3a566c',{solid:true,interactive:true,kind:'cyber'});this.box('cyberScreen','Cyber screen',[13.55,1.5,13.12],[1,.8,.04],'#64b8ff');
    this.box('whyTerminal','Root cause terminal',[16.0,1.15,13.55],[1.45,2.3,.8],'#5b4a7b',{solid:true,interactive:true,kind:'why'});this.box('whyScreen','5 Whys screen',[16.0,1.5,13.12],[1.05,.8,.04],'#c9a9ff');
    this.box('duelTerminal','Challenge terminal',[18.25,1.15,13.55],[1.35,2.3,.8],'#6a4b20',{solid:true,interactive:true,kind:'duel'});this.box('duelScreen','Duel screen',[18.25,1.5,13.12],[.95,.8,.04],'#f6b900');

    // Large in-world block-letter signs remain visible in desktop 3D and inside VR headsets.
    // Room terminal signs use a smaller scale so each workstation remains individually legible.
    this.stationSign('signBrief','BRIEF',[11.15,3.15,13.55],'#68c7ff',.064);
    this.stationSign('signCyber','CYBER',[13.55,3.35,13.55],'#64b8ff',.064);
    this.stationSign('signWhy','5 WHYS',[16.0,3.35,13.55],'#c9a9ff',.058);
    this.stationSign('signDuel','DUEL',[18.25,3.35,13.55],'#f6b900',.064);
    this.stationSign('signControlRoom','CONTROL ROOM',[14.7,3.55,5.76],'#9fd4ee',.075);
    this.stationSign('signHeight','HEIGHT',[16.3,3.5,-5],'#54d18f');
    this.stationSign('signManual','MANUAL',[-11.5,2.9,4],'#f6b900');
    this.stationSign('signReceive','RECEIVE',[-11,2.75,-4],'#54d18f');
    // manual handling area and receiving target
    this.box('dropZone','Receiving bay target',[-11,.03,-4],[5.5,.06,5.5],'#315f46',{interactive:false,glow:true});
    const crates=[[-14,.65,4,8,'#a8743d'],[-11.5,.7,4,14,'#9c6737'],[-9,.8,4,22,'#81562f']];crates.forEach((v,i)=>this.box('crate'+(i+1),`Parts crate ${i+1} • ${v[3]} kg`,[v[0],v[1],v[2]],[1.25,1.2,1.15],v[4],{solid:true,interactive:true,kind:'crate',weight:v[3],delivered:false,glow:i<2,hitSize:[1.9,2.35,1.9]}));crates.forEach((v,i)=>{this.box('crateLabel'+i,'Load label',[v[0],v[1]+.12,v[2]-.59],[.68,.35,.035],'#e6e1c8');this.box('crateBand'+i,'Crate band',[v[0],v[1],v[2]],[1.28,.13,1.18],'#3b3027')});
    // freely movable work objects: these do not count toward the assessed crate-delivery score
    const movable=[
      ['parcelA','Small parcel • 3 kg',[-17.1,.38,8.2],[.75,.7,.65],'#b7844e'],
      ['parcelB','Small parcel • 5 kg',[-15.9,.42,8.3],[.9,.8,.75],'#a96f3e'],
      ['partsTote','Blue parts tote • 6 kg',[-14.6,.43,8.2],[1.05,.8,.8],'#2f78a6'],
      ['toolCase','Tool case • 7 kg',[-13.2,.35,8.1],[1.15,.55,.65],'#39454e'],
      ['scannerCase','Scanner equipment case • 4 kg',[-11.8,.31,8.25],[.9,.55,.55],'#586d79'],
      ['packingBox1','Packing box A • 4 kg',[-10.4,.45,8.3],[.9,.9,.9],'#aa7d4e'],
      ['packingBox2','Packing box B • 6 kg',[-9.1,.5,8.25],[1.0,1.0,.9],'#956a42'],
      ['returnTote','Returns tote • 5 kg',[-7.8,.4,8.3],[1.0,.7,.85],'#3f7898'],
      ['emptyCarton','Empty carton • 1 kg',[-16.6,.4,10.0],[.95,.8,.8],'#c18c55'],
      ['wheelChock','Wheel chock • 2 kg',[-14.9,.22,10.1],[.65,.4,.45],'#e0a600'],
      ['coneMovable','Safety cone • 2 kg',[-13.2,.45,10.0],[.55,.9,.55],'#e66a27'],
      ['spillKit','Spill-kit case • 8 kg',[-11.4,.42,10.1],[1.0,.75,.75],'#d8b51c']
    ];
    movable.forEach(v=>this.box(v[0],v[1],v[2],v[3],v[4],{solid:true,interactive:true,kind:'movable',movable:true,groundY:v[2][1],glow:true,hitSize:[v[3][0]+.75,Math.max(1.9,v[3][1]+1.0),v[3][2]+.75]}));
    this.box('trolley','Pallet trolley',[-7.8,.45,4],[1.25,.35,2.3],'#e5a900',{solid:true,interactive:true,kind:'trolley'});this.box('trolleyHandle','Trolley handle',[-7.8,1.1,5],[.8,1.5,.12],'#2e3438');
    // height area
    this.box('platform','Maintenance platform',[12,4.2,-10],[6,.35,7],'#68747d',{solid:false});for(const x of [9.2,14.8])this.box('platPost'+x,'Platform post',[x,2,-10],[.25,4,.25],'#59636b',{solid:true});
    for(let y=.5;y<4.2;y+=.48)this.box('ladderRung'+y,'Ladder rung',[9.1,y,-6.6],[1.1,.09,.12],'#b7c2c8');
    this.box('ladderL','Ladder side',[8.6,2.1,-6.6],[.1,4.4,.1],'#89969d',{solid:true});this.box('ladderR','Ladder side',[9.6,2.1,-6.6],[.1,4.4,.1],'#89969d',{solid:true});
    // Rails extend above the landing so the access point is visible when the trainee is on top.
    this.box('ladderTopL','Ladder top rail',[8.6,4.85,-6.6],[.11,1.55,.11],'#d6e0e5',{solid:true});this.box('ladderTopR','Ladder top rail',[9.6,4.85,-6.6],[.11,1.55,.11],'#d6e0e5',{solid:true});
    this.box('ladderInteract','Access ladder',[9.1,1.55,-6.48],[1.15,.45,.18],'#54d18f',{interactive:true,kind:'ladder',glow:true,hitSize:[1.8,3.7,1.1]});
    this.box('ladderTopInteract','Ladder descent point',[9.1,5.18,-6.72],[.74,.26,.12],'#2d8f63',{interactive:true,kind:'ladder',glow:true,hitSize:[1.9,2.2,1.2]});
    this.box('harnessLocker','Harness station',[16.8,1.2,-5],[1.2,2.4,.7],'#246d55',{solid:true,interactive:true,kind:'heightStation'});
    this.box('guardrailGap','Missing edge protection',[12,5.05,-13.42],[4.1,.18,.16],'#f05b55',{interactive:false,kind:'guardrail',glow:true});
    this.box('heightTask','High-level sensor panel',[12,5.25,-11.9],[1.1,.8,.18],'#64b8ff',{interactive:true,kind:'heightTask',glow:true});
    // other guardrails
    // Open guardrail geometry: thin top/mid rails plus posts, rather than opaque wall slabs.
    for(const y of [4.82,5.45])this.box('railLeftBar'+y,'Guardrail',[9.3,y,-10.55],[.14,.14,5.55],'#c0c7ca',{solid:true});
    for(const z of [-13.1,-11.35,-9.6,-7.9])this.box('railLeftPost'+z,'Guardrail post',[9.3,5.05,z],[.14,1.55,.14],'#c0c7ca',{solid:true});
    for(const y of [4.82,5.45])this.box('railRightBar'+y,'Guardrail',[14.7,y,-10],[.14,.14,6.7],'#c0c7ca',{solid:true});
    for(const z of [-13.1,-11.45,-9.8,-8.15,-6.7])this.box('railRightPost'+z,'Guardrail post',[14.7,5.05,z],[.14,1.55,.14],'#c0c7ca',{solid:true});
    for(const y of [4.82,5.45])this.box('railFrontBar'+y,'Guardrail',[12.5,y,-6.6],[4.45,.14,.14],'#c0c7ca',{solid:true});
    for(const x of [10.3,11.75,13.2,14.65])this.box('railFrontPost'+x,'Guardrail post',[x,5.05,-6.6],[.14,1.55,.14],'#c0c7ca',{solid:true});
    // forklift scene
    this.forklift(4,-1);this.worker(1,-2.2,'Worker using phone',true);this.worker(-3,-18,'Warehouse operative',false);
    this.worker(8,-18,'Worker crossing vehicle lane',false);this.box('unsafeShortcut','Worker crossing live vehicle lane',[8,1.4,-18],[1,2.8,1],'#ef7a5b',{interactive:true,kind:'unsafeAct',unsafeWhy:'Pedestrian takes a shortcut through a vehicle operating lane instead of the segregated walkway',glow:true});
    this.worker(-5,-30,'Worker climbing storage rack',false);this.box('unsafeRackClimb','Worker climbing storage racking',[-5,3.2,-30],[1.2,4.6,1.2],'#ef7a5b',{interactive:true,kind:'unsafeAct',unsafeWhy:'Worker climbs racking instead of using approved access equipment',glow:true});
    this.worker(2,-31,'Worker without hi-vis',false);this.box('unsafeNoHiVis','Worker missing required site hi-vis',[2,1.4,-31],[1,2.8,1],'#ef7a5b',{interactive:true,kind:'unsafeAct',unsafeWhy:'Worker is in an operational warehouse zone without the fictional site-required high-visibility garment',glow:true});
    // hazards
    const oilSpill=this.hazard('spill','Oil spill',[5,.02,5],[4.2,.02,2.8],'#332815','Slippery spill left in pedestrian route');
    oilSpill.texture='models/oil_spill_image.png';
    oilSpill.yaw=0;
    this.hazard('blockedExit','Blocked emergency exit',[17,.6,-36.8],[3.1,1.2,1.4],'#b06a32','Pallet blocks emergency egress');
    this.hazard('openPanel','Open electrical panel',[-19.55,1.6,-6],[.3,2.2,1.4],'#cf4b4b','Electrical enclosure left open');
    const looseCable=this.hazard('looseCable','Trailing cable',[-2,.025,-8],[4.5,.02,1.8],'#d97745','Cable crosses the pedestrian route');
    looseCable.texture='models/trailing_cable.png';
    looseCable.hitSize=[4.5,0.6,1.8];
    const chemDrum=this.hazard('chemDrum','Unlabelled chemical drum',[17,.85,-19],[1.2,1.7,1.2],'#2a7bbd','Chemical container has no readable label');
    chemDrum.texture='models/Unlabelled_chemical_drum.png';
    chemDrum.planeOrientation='vertical';
    chemDrum.crossPlane=true;
    const damagedPallet=this.hazard('damagedPallet','Damaged pallet',[-2,.03,-24],[2.2,.02,1.85],'#8b5b35','Broken pallet boards and protruding edge');
    damagedPallet.texture='models/damaged_pallet.png';
    damagedPallet.hitSize=[2.2,0.6,1.85];
    this.hazard('forkliftKeys','Forklift left energised',[4,1.3,-.65],[.25,.3,.3],'#f6b900','Forklift unattended with controls/keys available');
    this.hazard('phoneWorker','Distracted worker',[1,1.4,-2.2],[.8,2.8,.8],'#de6d5b','Worker distracted by phone near vehicle route');
    this.hazard('stacking','Unstable stacked load',[-14,3,-20],[2.8,4.5,2.4],'#c47435','Load is leaning and poorly secured');
    this.hazard('edgeGap','Missing edge protection',[12,5.05,-13.42],[4.1,.65,.5],'#ef5b55','Platform edge protection is incomplete',true);
    // unsafe act markers / props
    // emergency exit door & signage
    this.box('exitDoorFrame','Emergency exit frame',[18.9,1.65,-36.8],[.22,3.35,2.65],'#1b252c');
    this.box('exitDoor','Emergency exit',[18.9,1.6,-36.8],[.16,3.15,2.4],'#1e824c');
    this.box('exitPushBar','Exit crash bar',[18.78,1.25,-36.8],[.12,.12,2.0],'#e8ecef');
    this.box('exitPushBarBrackL','Crash bar bracket',[18.82,1.25,-37.7],[.14,.18,.08],'#c0392b');
    this.box('exitPushBarBrackR','Crash bar bracket',[18.82,1.25,-35.9],[.14,.18,.08],'#c0392b');
    // Illuminated overhead exit sign box facing into the warehouse (westward toward x=0)
    this.box('exitSignBox','Emergency Exit sign header',[18.85,3.65,-36.8],[.28,.55,2.2],'#7b1818');
    this.box('exitSignFace','EXIT illuminated face',[18.7,3.65,-36.8],[.04,.42,1.9],'#d63031',{glow:true});
    // Distinctive luminous lettering "EXIT" on the door sign facing players
    const exitLetterY=3.65;
    const fontE=['1111','1000','1110','1000','1111'];
    const fontX=['1001','0110','0000','0110','1001'];
    const fontI=['1111','0110','0110','0110','1111'];
    const fontT=['1111','0110','0110','0110','0110'];
    const word=[{ch:fontE,z:-37.45},{ch:fontX,z:-37.05},{ch:fontI,z:-36.65},{ch:fontT,z:-36.25}];
    word.forEach((item,wi)=>{
      item.ch.forEach((row,rIdx)=>{
        [...row].forEach((dot,cIdx)=>{
          if(dot==='1'){
            this.box(`exitSignLetter_${wi}_${rIdx}_${cIdx}`,'EXIT sign letter',[18.66,exitLetterY+(2-rIdx)*.065,item.z+cIdx*.055],[.02,.055,.045],'#ffffff',{glow:true});
          }
        });
      });
    });
  }
  stationSign(id,text,p,color,scale=.105){
    const font={
      'A':['01110','10001','10001','11111','10001','10001','10001'],
      'B':['11110','10001','10001','11110','10001','10001','11110'],
      'C':['01111','10000','10000','10000','10000','10000','01111'],
      'D':['11110','10001','10001','10001','10001','10001','11110'],
      'E':['11111','10000','10000','11110','10000','10000','11111'],
      'F':['11111','10000','10000','11110','10000','10000','10000'],
      'G':['01111','10000','10000','10111','10001','10001','01111'],
      'H':['10001','10001','10001','11111','10001','10001','10001'],
      'I':['11111','00100','00100','00100','00100','00100','11111'],
      'L':['10000','10000','10000','10000','10000','10000','11111'],
      'M':['10001','11011','10101','10101','10001','10001','10001'],
      'N':['10001','11001','10101','10011','10001','10001','10001'],
      'O':['01110','10001','10001','10001','10001','10001','01110'],
      'R':['11110','10001','10001','11110','10100','10010','10001'],
      'S':['01111','10000','10000','01110','00001','00001','11110'],
      'T':['11111','00100','00100','00100','00100','00100','00100'],
      'U':['10001','10001','10001','10001','10001','10001','01110'],
      'V':['10001','10001','10001','10001','10001','01010','00100'],
      'W':['10001','10001','10001','10101','10101','10101','01010'],
      'X':['10001','10001','01010','00100','01010','10001','10001'],
      'Y':['10001','10001','01010','00100','00100','00100','00100'],
      '5':['11111','10000','10000','11110','00001','00001','11110'],
      ' ':['00000','00000','00000','00000','00000','00000','00000']
    };
    const cell=scale*.88,chars=[...text],w=(chars.length*6-1)*scale,boardH=7*scale+.35;
    // Opaque centre board plus separate lettering on BOTH faces.
    // Without this, a word viewed from the rear is horizontally mirrored.
    this.box(id+'Board',text+' station sign',[p[0],p[1],p[2]],[w+.42,boardH,.14],'#17212a',{glow:false});
    const left=p[0]-w/2+scale*.5;
    const right=p[0]+w/2-scale*.5;
    const drawFace=(suffix,z,backFace)=>{
      chars.forEach((ch,ci)=>{
        const rows=font[ch]||font[' '];
        rows.forEach((row,ri)=>{[...row].forEach((v,co)=>{if(v!=='1')return;
          // From the -Z side screen-right corresponds to -X, so mirror the WORLD
          // placement on that face. The resulting word still reads left-to-right.
          const col=ci*6+co;
          const x=backFace?right-col*scale:left+col*scale;
          this.box(`${id}_${suffix}_${ci}_${ri}_${co}`,text+' sign',[x,p[1]+((3-ri)*scale),z],[cell,cell,.045],color,{glow:true});
        })});
      });
    };
    drawFace('front',p[2]+.095,false);
    drawFace('back',p[2]-.095,true);
  }
  rack(id,x,z){
    // Upright rack columns (corners and middle support posts)
    for(const dx of [-1.75, 1.75]){
      for(const dz of [-2.75, 0, 2.75]){
        this.box(`${id}_up_${dx}_${dz}`,'Rack upright',[x+dx, 2.6, z+dz],[.15, 5.2, .15],'#5e6c77',{solid:true});
      }
      // Side cross-ties on the frame
      for(const y of [1.4, 3.1, 4.8]){
        this.box(`${id}_sideTie_${dx}_${y}`,'Frame side tie',[x+dx, y, z],[.10, .10, 5.4],'#53616c');
      }
    }
    
    // Palette of realistic warehouse packaging & storage carton tones
    const colors=['#b88a56','#a07240','#c4985c','#4a6377','#6c5843','#926c3d','#5a7082','#b08350'];
    let boxCounter=0;
    const mediumCardboard={
      top:'models/medium_topside.png?v=2',
      long:'models/medium_longside.png?v=2',
      width:'models/medium_widthside.png?v=2'
    };
    const largeCardboard={
      top:'models/large_topside.png?v=1',
      long:'models/large_longside.png?v=1',
      width:'models/large_widthside.png?v=1'
    };
    const smallCardboard={
      top:'models/small_topside.png?v=1',
      long:'models/small_longside.png?v=1',
      width:'models/small_widthside.png?v=1'
    };
    
    // 3 shelf tiers: bottom (y=0.6), middle (y=2.3), top (y=4.0)
    const shelfHeights=[.6, 2.3, 4.0];
    
    shelfHeights.forEach((shelfY,shelfIdx)=>{
      // Front and Back cross beams (safety orange/yellow rack beams)
      for(const dz of [-2.75, 2.75]){
        this.box(`${id}_bX_${shelfIdx}_${dz}`,'Rack beam',[x, shelfY, z+dz],[3.55, .14, .14],'#c29c27',{solid:true});
      }
      // Left and Right longitudinal beams
      for(const dx of [-1.75, 1.75]){
        this.box(`${id}_bZ_${shelfIdx}_${dx}`,'Rack beam',[x+dx, shelfY, z],[.14, .14, 5.4],'#c29c27',{solid:true});
      }
      // Center longitudinal support beam
      this.box(`${id}_bC_${shelfIdx}`,'Center support rail',[x, shelfY, z],[.12, .12, 5.4],'#5e6c77');
      
      // Galvanized steel shelf decking / support panels directly under the boxes
      this.box(`${id}_deck_${shelfIdx}`,'Galvanized shelf decking',[x, shelfY+0.09, z],[3.4, .04, 5.35],'#85929c',{solid:true});
      
      // Shelf support cross bars underneath the decking
      for(const dz of [-1.8, -0.9, 0.9, 1.8]){
        this.box(`${id}_crossBar_${shelfIdx}_${dz}`,'Shelf support bar',[x, shelfY, z+dz],[3.4, .08, .10],'#6b7883');
      }
      
      const deckTop=shelfY+0.11; // Top surface of the shelf decking where boxes rest
      
      [-0.88, 0.88].forEach((dx,sideIdx)=>{
        const cx=x+dx;
        
        if(shelfIdx===0){
          // Shelf 1 (Bottom): 1 Large box, 1 Medium box, 1 Small box
          const lSize=[1.25, 0.95, 1.4];
          const lCol=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_lg`,'Storage carton (Large)',[cx, deckTop+lSize[1]/2, z-1.25],lSize,lCol,{solid:true,texturedFaces:largeCardboard});
          
          const mSize=[1.15, 0.75, 1.05];
          const mCol=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_md`,'Storage carton (Medium)',[cx, deckTop+mSize[1]/2, z+0.2],mSize,mCol,{solid:true,texturedFaces:mediumCardboard});
          
          const sSize=[0.95, 0.55, 0.75];
          const sCol=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_sm`,'Storage carton (Small)',[cx, deckTop+sSize[1]/2, z+1.45],sSize,sCol,{solid:true,texturedFaces:smallCardboard});
          
        }else if(shelfIdx===1){
          // Shelf 2 (Middle): 1 Medium box, 1 Large box, 1 Medium box + 1 Stacked Small box
          const m1Size=[1.15, 0.75, 1.05];
          const m1Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_md1`,'Storage carton (Medium)',[cx, deckTop+m1Size[1]/2, z-1.35],m1Size,m1Col,{solid:true,texturedFaces:mediumCardboard});
          
          const stSize=[0.85, 0.5, 0.7];
          const stCol=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_st`,'Storage carton (Small)',[cx, deckTop+m1Size[1]+stSize[1]/2, z-1.35],stSize,stCol,{solid:true,texturedFaces:smallCardboard});
          
          const lSize=[1.25, 0.9, 1.35];
          const lCol=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_lg`,'Storage carton (Large)',[cx, deckTop+lSize[1]/2, z+0.1],lSize,lCol,{solid:true,texturedFaces:largeCardboard});
          
          const m2Size=[1.1, 0.72, 1.0];
          const m2Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_md2`,'Storage carton (Medium)',[cx, deckTop+m2Size[1]/2, z+1.45],m2Size,m2Col,{solid:true,texturedFaces:mediumCardboard});
          
        }else{
          // Shelf 3 (Top): Varied Small and Medium cartons
          const s1Size=[0.9, 0.52, 0.75];
          const s1Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_sm1`,'Storage carton (Small)',[cx, deckTop+s1Size[1]/2, z-1.55],s1Size,s1Col,{solid:true,texturedFaces:smallCardboard});
          
          const m1Size=[1.1, 0.7, 1.05];
          const m1Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_md1`,'Storage carton (Medium)',[cx, deckTop+m1Size[1]/2, z-0.5],m1Size,m1Col,{solid:true,texturedFaces:mediumCardboard});
          
          const s2Size=[0.9, 0.55, 0.75];
          const s2Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_sm2`,'Storage carton (Small)',[cx, deckTop+s2Size[1]/2, z+0.55],s2Size,s2Col,{solid:true,texturedFaces:smallCardboard});
          
          const m2Size=[1.15, 0.72, 1.05];
          const m2Col=colors[(boxCounter++)%colors.length];
          this.box(`${id}_s${shelfIdx}_${sideIdx}_md2`,'Storage carton (Medium)',[cx, deckTop+m2Size[1]/2, z+1.55],m2Size,m2Col,{solid:true,texturedFaces:mediumCardboard});
        }
      });
    });
  }
  forklift(x,z){this.box('forkBody','Forklift',[x,.75,z],[2,1.5,3.1],'#d49c00',{solid:true});this.box('forkCab','Forklift cab',[x,1.9,z+.3],[1.7,1.7,1.8],'#36434e',{solid:true});this.box('forkMast','Forklift mast',[x,1.7,z-1.55],[1.8,3.3,.22],'#20272c',{solid:true});this.box('fork1','Fork tine',[x-.55,.18,z-2.7],[.18,.16,2.4],'#3b4246',{solid:true});this.box('fork2','Fork tine',[x+.55,.18,z-2.7],[.18,.16,2.4],'#3b4246',{solid:true});for(const dx of [-.82,.82])for(const dz of [-.9,.9])this.box('wheel'+dx+dz,'Forklift wheel',[x+dx,.3,z+dz],[.45,.6,.55],'#151719',{solid:true})}
  worker(x,z,label,phone){this.box('workerBody'+x+z,label,[x,1.35,z],[.62,1.4,.45],phone?'#e36c53':'#e9c84a',{solid:true});this.box('workerHead'+x+z,label,[x,2.28,z],[.45,.45,.45],'#c88768');this.box('workerLeg1'+x+z,label,[x-.17,.48,z],[.22,.9,.24],'#273746');this.box('workerLeg2'+x+z,label,[x+.17,.48,z],[.22,.9,.24],'#273746');if(phone)this.box('phone'+x+z,'Mobile phone',[x+.38,1.55,z-.2],[.12,.22,.04],'#1b1d21')}
  hazard(id,label,p,s,c,why,overlap=false){const physical=new Set(['blockedExit','chemDrum','damagedPallet','stacking']);const o=this.box(id,label,p,s,c,{interactive:true,kind:'hazard',hazardWhy:why,glow:true,solid:physical.has(id)});o.overlap=overlap;this.hazardIds.push(id);return o}
  _applySaved(){for(const id of this.state.hazards||[]){const o=this.e.get(id);if(o){o.color='#3eaf77';o.glow=false;o.interactive=false}}for(const id of this.state.unsafeActs||[]){const o=this.e.get(id);if(o){o.color='#3eaf77';o.glow=false;o.interactive=false}}if(this.state.harness){const h=this.e.get('harnessLocker');if(h)h.color='#3eaf77'}if(this.state.heightPlan){const g=this.e.get('guardrailGap');if(g){g.color='#43b97b';g.glow=false;g.solid=true}}if(this.state.heightDone){const g=this.e.get('guardrailGap');if(g){g.color='#43b97b';g.glow=false;g.interactive=false}}}
  _wire(){this.e.onHover=o=>this.ui.hover?.(o,this.e.carried);this.e.onInteract=(o,source)=>this.interact(o,source);this.e.onDrop=o=>this.handleDrop(o);this.e.onVRState=on=>this.ui.vrState?.(on)}
  interact(o,source){switch(o.kind){case'terminal':this.briefing();break;case'crate':this.crate(o);break;case'movable':this.movable(o);break;case'trolley':this.ui.toast('Mechanical aid available for bulky or higher-risk loads.');break;case'heightStation':this.planHeight();break;case'ladder':this.ladder();break;case'heightTask':this.heightTask(o);break;case'guardrail':this.guardrail(o);break;case'hazard':this.reportHazard(o);break;case'unsafeAct':this.reportUnsafe(o);break;case'cyber':this.cyber();break;case'why':this.whys();break;case'duel':this.duelStartMenu();break;default:this.ui.toast(o.label)}}
  briefing(){this.state.briefed=true;this.save();this.ui.openModal(`<span class="eyebrow">SHIFT BRIEFING</span><h2>Welcome to WareWise XR</h2><p>This is a practical training simulation. Complete the six modules in any order. Use the 3D environment to apply the controls—not just recall them.</p><div class="terminal-grid"><div class="terminal-tile"><small>01</small><b>Manual handling</b><p>Assess, pick up, carry and place parts crates.</p></div><div class="terminal-tile"><small>02</small><b>Working at height</b><p>Use the harness station and fix edge protection.</p></div><div class="terminal-tile"><small>03</small><b>Hazard perception</b><p>Find ten unsafe conditions around the warehouse.</p></div><div class="terminal-tile"><small>04</small><b>Unsafe acts</b><p>Identify behaviours that expose people to harm.</p></div><div class="terminal-tile"><small>05</small><b>5 Whys</b><p>Build a root-cause chain at the purple terminal.</p></div><div class="terminal-tile"><small>06</small><b>Cyber awareness</b><p>Classify messages at the blue terminal.</p></div></div><div class="modal-actions"><button class="primary" data-close>Begin shift</button></div>`);this.ui.setObjective('Manual handling: move 3 crates','Assess each crate, use E to pick up, carry it to the green receiving bay and press G to place it.',Math.min(1,this.state.manualDelivered/3));}
  crate(o){if(o.delivered)return;if(!this.manualQuizPassed){this.manualCheck(()=>{this.manualQuizPassed=true;this.ui.toast('Handling check passed • crate unlocked');this._pickupCrate(o)});return}this._pickupCrate(o)}
  _pickupCrate(o){if(o.weight>=22&&this.state.manualDelivered<2){this.ui.openModal(`<span class="eyebrow">SEQUENCE CONTROL</span><h2>Mechanical-aid load</h2><p>For this exercise, first complete the two hand-carry loads so the assessor can observe your pick-up, carrying route and placement interaction. Then return to this bulky crate and select the pallet trolley.</p><div class="modal-actions"><button class="primary" data-close>Continue</button></div>`);return}if(o.weight>=22){this.ui.openModal(`<span class="eyebrow">LOAD ASSESSMENT</span><h2>${o.label}</h2><p>This bulky load is marked for mechanical assistance under the fictional site risk assessment. What should you do?</p><div class="choice-list"><button class="choice" data-heavy="wrong">Lift it quickly before it feels heavy</button><button class="choice" data-heavy="right">Use the pallet trolley / get suitable assistance</button><button class="choice" data-heavy="wrong">Drag it by one corner</button></div>`);this.ui.bindHeavy?.(o,()=>this.mechanicalMove(o));return}if(this.e.pickup(o)){this.ui.carry?.(o);this.ui.toast(`${o.label} picked up • carry it to the receiving bay`)}}
  manualCheck(pass){let q=0;const qs=[{q:'Before lifting a load, what comes first?',a:['Plan the handling task and clear the route','Twist to test the weight','Lift first, assess later'],c:0},{q:'During a basic two-handed lift, where should the load generally be kept?',a:['As far from the body as possible','Close to the body where practicable','Above shoulder level'],c:1},{q:'If the task remains higher risk, what is the better control?',a:['Use suitable handling aids or redesign the task','Rely only on lifting technique','Work faster'],c:0}];const render=()=>{const x=qs[q];this.ui.openModal(`<span class="eyebrow">PRACTICAL LIFT CHECK ${q+1}/3</span><h2>${x.q}</h2><div class="choice-list">${x.a.map((a,i)=>`<button class="choice" data-quiz="${i}">${a}</button>`).join('')}</div><p><small>Training principles: assess the task/load/environment and use handling aids where appropriate.</small></p>`);this.ui.bindQuiz?.(x.c,(ok)=>{if(!ok){this.score(-25,'Unsafe handling choice');return}q++;if(q<qs.length)render();else{this.ui.closeModal();this.score(100,'Manual handling knowledge check');pass()}})};render()}
  movable(o){if(this.e.carried){this.ui.toast('Place the object you are already carrying first');return}if(this.e.pickup(o)){this.ui.carry?.(o);this.ui.toast(`${o.label} picked up • move it anywhere and press G to set it down`)}}
    mechanicalMove(o){o.position=[-11,.8,-4];o.delivered=true;o.interactive=false;o.solid=true;this.state.manualDelivered=Math.max(this.state.manualDelivered,3);this.state.moduleDone.manual=true;this.score(250,'Mechanical aid selected and load transferred');this.ui.closeModal();this.sync();this.ui.setObjective('Hazard perception','Explore the warehouse and report the highlighted unsafe conditions you find.',this.state.hazards.length/10)}
  handleDrop(o){this.ui.carry?.(null);if(o.kind==='movable'){o.position[1]=o.groundY??Math.max(.25,o.size[1]/2);o.interactive=true;o.solid=true;this.ui.toast(`${o.label} set down • you can pick it up again`);return}if(o.kind!=='crate')return;const d=Math.hypot(o.position[0]-this.dropZone.x,o.position[2]-this.dropZone.z);if(d<this.dropZone.r){o.position=[-12.5+this.state.manualDelivered*1.5,.65,-4];o.delivered=true;o.interactive=false;o.solid=true;o.glow=false;this.state.manualDelivered=Math.min(3,this.state.manualDelivered+1);this.score(180,'Crate placed in receiving bay');if(this.state.manualDelivered>=3){this.state.moduleDone.manual=true;this.score(250,'Manual handling module complete');this.ui.setObjective('Hazard perception','Explore the warehouse and report 10 unsafe conditions.',this.state.hazards.length/10)}else this.ui.setObjective(`Manual handling: ${this.state.manualDelivered}/3 delivered`,'Return for another crate and repeat the safe handling process.',this.state.manualDelivered/3)}else{this.ui.toast('Load set down • not in the receiving bay');o.position[1]=Math.max(.65,o.position[1]);o.interactive=true;o.glow=true}this.save();this.sync()}
  planHeight(){if(this.state.heightPlan){this.ui.toast('Work-at-height controls already prepared');return}this.ui.openModal(`<span class="eyebrow">WORK AT HEIGHT PLAN</span><h2>Platform edge defect identified</h2><p>The task is not authorised until the fall risk is controlled. Which sequence best follows the control hierarchy for this fictional exercise?</p><div class="choice-list"><button class="choice" data-height="wrong">Put on a harness and climb beside the open edge</button><button class="choice" data-height="right">Confirm the task cannot be done from ground level, restore collective edge protection, then use the planned access system; wear the site-required harness as a supplemental control</button><button class="choice" data-height="wrong">Climb first and decide what protection is needed at the top</button></div>`);document.querySelectorAll('[data-height]').forEach(b=>b.onclick=()=>{if(b.dataset.height==='right'){b.classList.add('correct');this.state.heightPlan=true;this.state.harness=true;const g=this.e.get('guardrailGap');if(g){g.color='#43b97b';g.glow=false;g.solid=true}if(!this.state.hazards.includes('edgeGap'))this.state.hazards.push('edgeGap');const hz=this.e.get('edgeGap');if(hz){hz.color='#3eaf77';hz.glow=false;hz.interactive=false}this.score(260,'Fall-prevention controls prepared');this.ui.ppe?.(true);this.ui.closeModal();this.ui.setObjective('Working at height','Use the now-authorised ladder access, then service the blue sensor panel.',.6);this.save();this.sync()}else{b.classList.add('wrong');this.score(-30,'Control hierarchy choice needs review')}})}
  ladder(){if(!this.atHeight&&!this.state.heightPlan){this.ui.openModal(`<span class="eyebrow">ACCESS CONTROL</span><h2>Do not climb yet</h2><p>The incomplete edge protection must be controlled before access. Use the green work-at-height control station to plan the task and restore collective protection.</p><div class="modal-actions"><button class="primary" data-close>Understood</button></div>`);return}if(!this.atHeight){this.e.camera.position=[11,5.75,-8.5];this.atHeight=true;this.score(80,'Controlled access to protected platform');this.ui.setObjective('Service the high-level sensor','Interact with the blue sensor panel. The platform edge protection has been restored for this exercise.',.8)}else{this.e.camera.position=[9.1,1.68,-5.5];this.atHeight=false;this.ui.toast('Returned to warehouse floor')}}
  heightTask(o){if(!this.atHeight){this.ui.toast('Use the authorised ladder access before servicing the sensor.');return}if(this.state.heightDone){this.ui.toast('High-level task already completed');return}o.color='#43b97b';o.glow=false;o.interactive=false;this.state.heightDone=true;this.state.moduleDone.height=true;this.score(320,'Working at height module complete');this.ui.setObjective('Return to warehouse floor','Use the ladder to descend, then continue the remaining modules.',1);this.save();this.sync()}
  guardrail(){this.ui.toast('Collective edge protection is controlled through the ground-level work-at-height station.')}
  reportHazard(o){if(this.duel?.active){this.duelHit(o);return}if(this.state.hazards.includes(o.id)){this.ui.toast('Already reported');return}this.state.hazards.push(o.id);o.color='#3eaf77';o.glow=false;o.interactive=false;this.score(110,`Hazard reported: ${o.label}`);this.ui.openModal(`<span class="eyebrow">HAZARD ${this.state.hazards.length}/10</span><h2>${o.label}</h2><p>${o.hazardWhy}</p><p><b>Action:</b> isolate/report the condition and apply the site control before work continues. This fictional simulation does not replace a workplace risk assessment.</p><div class="modal-actions"><button class="primary" data-close>Continue search</button></div>`);if(this.state.hazards.length>=10){this.state.moduleDone.hazards=true;this.score(500,'Hazard perception module complete');this.ui.setObjective('Complete remaining modules','Visit the purple 5 Whys terminal and blue cyber terminal.',.85)}else this.ui.setObjective(`Hazard perception: ${this.state.hazards.length}/10`,'Keep scanning routes, storage areas, equipment and exits.',this.state.hazards.length/10);this.save();this.sync()}
  reportUnsafe(o){if(this.state.unsafeActs.includes(o.id)){this.ui.toast('Unsafe act already identified');return}this.state.unsafeActs.push(o.id);o.color='#3eaf77';o.glow=false;o.interactive=false;this.score(140,`Unsafe act identified: ${o.label}`);this.ui.openModal(`<span class="eyebrow">UNSAFE ACT ${this.state.unsafeActs.length}/3</span><h2>${o.label}</h2><p>${o.unsafeWhy}.</p><p><b>Coaching response:</b> stop the exposure where necessary, explain the safer system of work and address why the shortcut or deviation was possible.</p><div class="modal-actions"><button class="primary" data-close>Continue</button></div>`);if(this.state.unsafeActs.length>=3){this.state.unsafeDone=true;this.state.moduleDone.unsafe=true;this.score(350,'Unsafe acts module complete')}this.save();this.sync()}
  whys(){if(this.state.whyDone){this.ui.toast('5 Whys module already complete');return}const opts=['Oil leaked from a forklift hydraulic hose','The hose had deteriorated and split','Inspection did not identify the deterioration','The inspection checklist omitted hose-condition checks','Maintenance control had not been updated after prior hose failures'];this.ui.openModal(`<span class="eyebrow">ROOT CAUSE PUZZLE</span><h2>Why was there an oil spill?</h2><p>Build the most logical cause chain from immediate cause toward the management-system root cause.</p><div class="why-chain">${opts.map((_,i)=>`<div class="why-step"><span>${i+1}</span><select data-why="${i}"><option value="">Choose a cause…</option>${opts.map((x,j)=>`<option value="${j}">${x}</option>`).join('')}</select></div>`).join('')}</div><div class="modal-actions"><button class="primary" id="checkWhys">Check chain</button></div>`);this.ui.bindWhys?.(()=>{const vals=[...document.querySelectorAll('[data-why]')].map(s=>Number(s.value));const ok=vals.every((v,i)=>v===i);if(ok){this.state.whyDone=true;this.state.moduleDone.why=true;this.score(350,'5 Whys root-cause chain complete');this.ui.closeModal();this.save()}else{this.score(-30,'Root-cause chain needs another look');this.ui.toast('Start with the immediate cause, then ask why that condition existed.')}})}
  cyber(){if(this.state.cyberDone){this.ui.toast('Cyber module already complete');return}const mails=[{s:'Password expires today — verify now',f:'IT Service <support@warew1se-security.example>',b:'Urgent: sign in through this link within 15 minutes or lose access.',p:true},{s:'Updated loading schedule',f:'Dispatch Team <dispatch@warewise.example>',b:'The revised schedule is attached in the approved shared system. No password requested.',p:false},{s:'CEO needs gift cards immediately',f:'Director <chief-exec-private@fastmail.example>',b:'I am in a meeting. Buy gift cards and send the codes. Do not call me.',p:true},{s:'MFA enrolment notice',f:'IT Service <it@warewise.example>',b:'Open the company portal from your saved bookmark and follow the MFA instructions.',p:false},{s:'Missed delivery photo',f:'Courier <track-now@parcel-alert.example>',b:'Open this shortened link to view the parcel and pay a small redelivery fee.',p:true}];let idx=0,correct=0;const render=()=>{const m=mails[idx];this.ui.openModal(`<span class="eyebrow">CYBER AWARENESS ${idx+1}/5</span><h2>Inbox triage</h2><div class="email-card"><header><b>${m.s}</b><small>${m.f}</small></header><p>${m.b}</p><div class="email-actions"><button data-mail="safe">Treat as legitimate</button><button data-mail="phish">Report as suspicious</button></div></div><p><small>Check sender/context, urgency, unusual requests and where links would take you. Use trusted reporting routes.</small></p>`);this.ui.bindMail?.((choice)=>{const ok=(choice==='phish')===m.p;if(ok){correct++;this.score(60,'Correct cyber decision')}else this.score(-25,'Incorrect cyber decision');idx++;if(idx<mails.length)render();else{this.state.cyberDone=true;this.state.moduleDone.cyber=true;this.score(correct===5?300:150,`Cyber module complete • ${correct}/5 correct`);this.ui.closeModal();this.save();this.sync()}})};render()}
  duelStartMenu(){this.ui.openModal(`<span class="eyebrow">COMPETITIVE MODE</span><h2>Hazard Hunt Duel</h2><p>Two players take turns. Each gets 45 seconds in the same warehouse. Report as many marked hazards as possible. The higher score wins.</p><div class="duel-score"><div><small>PLAYER A</small><b>${this.duel?.a??'—'}</b></div><div><small>PLAYER B</small><b>${this.duel?.b??'—'}</b></div></div><div class="modal-actions"><button class="primary" id="startDuel">Start Player A</button></div>`);this.ui.bindDuel?.(()=>this.beginDuel('A'))}
  beginDuel(player){this.ui.closeModal();this.duel={...(this.duel||{}),active:true,player,hits:new Set(),time:45};for(const id of this.hazardIds){const o=this.e.get(id);if(o){o.interactive=true;o.glow=true;o.color='#ef5b55'}}this.ui.setObjective(`Duel • Player ${player} • 45 seconds`,'Report as many red hazards as possible. Each unique find = 1 point.',0);clearInterval(this.duelTimer);this.duelTimer=setInterval(()=>{if(!this.duel?.active)return;this.duel.time--;this.ui.setObjective(`Duel • Player ${player} • ${this.duel.time}s`,`Find hazards • score ${this.duel.hits.size}`,1-this.duel.time/45);if(this.duel.time<=0)this.endDuel()},1000)}
  duelHit(o){if(this.duel.hits.has(o.id))return;this.duel.hits.add(o.id);o.color='#3eaf77';o.glow=false;o.interactive=false;this.ui.toast(`Player ${this.duel.player}: ${this.duel.hits.size} hazards`)}
  endDuel(){clearInterval(this.duelTimer);const p=this.duel.player,sc=this.duel.hits.size;this.duel.active=false;if(p==='A'){this.duel.a=sc;this.ui.openModal(`<span class="eyebrow">PLAYER A COMPLETE</span><h2>${sc} hazards found</h2><p>Pass the device/headset to Player B. The scene will reset for an equal attempt.</p><div class="modal-actions"><button class="primary" id="nextDuel">Start Player B</button></div>`);this.ui.bindNextDuel?.(()=>this.beginDuel('B'))}else{this.duel.b=sc;const win=this.duel.a===sc?'Draw':this.duel.a>sc?'Player A wins':'Player B wins';this.state.highScores.push({date:new Date().toISOString(),score:Math.max(this.duel.a,this.duel.b)});this.state.highScores=this.state.highScores.sort((a,b)=>b.score-a.score).slice(0,5);this.save();this.ui.openModal(`<span class="eyebrow">DUEL RESULT</span><h2>${win}</h2><div class="duel-score"><div><small>PLAYER A</small><b>${this.duel.a}</b></div><div><small>PLAYER B</small><b>${this.duel.b}</b></div></div><div class="modal-actions"><button class="primary" data-close>Return to shift</button></div>`);this._restoreHazards()}}
  _restoreHazards(){for(const id of this.hazardIds){const o=this.e.get(id);if(!o)continue;const done=this.state.hazards.includes(id);o.interactive=!done;o.glow=!done;o.color=done?'#3eaf77':'#ef5b55'}this.sync()}
}
window.WareTraining=WareTraining;
})();
