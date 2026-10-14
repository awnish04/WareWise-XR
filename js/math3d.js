(function(){
'use strict';
const M={};
M.identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
M.multiply=function(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++){for(let r=0;r<4;r++){o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];}}return o};
M.perspective=function(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])};
M.lookAt=function(eye,target,up=[0,1,0]){let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1])};
M.model=function(pos,size=[1,1,1],yaw=0){const c=Math.cos(yaw),s=Math.sin(yaw),sx=size[0],sy=size[1],sz=size[2];return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,pos[0],pos[1],pos[2],1])};
M.translationScale=function(x,y,z,sx,sy,sz){return new Float32Array([sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1])};
M.normalize=function(v){const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
M.add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
M.scale=(v,s)=>[v[0]*s,v[1]*s,v[2]*s];
M.distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
M.transformDir=function(m,v){return M.normalize([m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]])};
M.rayAABB=function(origin,dir,obj,maxDist=5){const p=obj.position,s=obj.size;const min=[p[0]-s[0]/2,p[1]-s[1]/2,p[2]-s[2]/2],max=[p[0]+s[0]/2,p[1]+s[1]/2,p[2]+s[2]/2];let tmin=0,tmax=maxDist;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-6){if(origin[i]<min[i]||origin[i]>max[i])return null;}else{const inv=1/dir[i];let t1=(min[i]-origin[i])*inv,t2=(max[i]-origin[i])*inv;if(t1>t2){const q=t1;t1=t2;t2=q}tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null;}}return tmin};
window.WWMath=M;
})();
