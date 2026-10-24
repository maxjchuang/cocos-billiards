"""Offline independent numerical reference. No game runtime imports.
Published material/planar geometry; documented Hertz/damping/friction equations.
This is a reduced-equation DOP853 reference, not the paper's 3D output curve.
"""
import json, math, hashlib
from pathlib import Path
import numpy as np
import scipy
from scipy.integrate import solve_ivp

fixtures=json.loads(Path('validation/calibration/reference-fixtures.json').read_text())
m=fixtures['material']; radius=m['radius']; mass=m['baseMassKg']; inertia=.4*mass*radius**2
stiffness=4/3/(2*(1-m['poisson']**2)/m['youngPa'])*math.sqrt(radius/2)
log=math.log(m['restitution']); beta=-log/math.sqrt(log*log+math.pi**2)

def run(name,initial):
    n=len(initial); y=np.array([[b['x'],b['z'],b['vx'],b['vz'],b.get('wy',0)] for b in initial],float)
    i,j=np.triu_indices(n,1)
    def rhs(t,flat):
        state=flat.reshape(n,5); rel=state[j,:2]-state[i,:2]; length=np.sqrt((rel*rel).sum(axis=1)); overlap=np.maximum(0,2*radius-length)
        normal=rel/length[:,None]; tangent=np.column_stack((-normal[:,1],normal[:,0])); velocity=state[j,2:4]-state[i,2:4]
        closing=-(velocity*normal).sum(axis=1)
        damping=m['dampingScale']*math.sqrt(5)*beta*np.sqrt(stiffness*np.sqrt(overlap)*mass/2)
        force_n=np.maximum(0,stiffness*overlap**1.5+damping*closing)
        lever=length/2
        slip=(velocity*tangent).sum(axis=1)+lever*(state[i,4]+state[j,4])
        force_t=-m['friction']*force_n*np.clip(slip/m['frictionVelocity'],-1,1)
        force=force_n[:,None]*normal+force_t[:,None]*tangent
        derivative=np.zeros((n,5));derivative[:,:2]=state[:,2:4]
        np.add.at(derivative[:,2:4],i,-force/mass);np.add.at(derivative[:,2:4],j,force/mass)
        np.add.at(derivative[:,4],i,lever*force_t/inertia);np.add.at(derivative[:,4],j,lever*force_t/inertia)
        return derivative.ravel()
    times=np.linspace(0,.0015,301)
    result=solve_ivp(rhs,(0,.0015),y.ravel(),method='DOP853',rtol=2e-11,atol=1e-13,max_step=1e-6,t_eval=times)
    if not result.success:raise RuntimeError(result.message)
    return {'name':name,'initial':initial,'method':'SciPy DOP853','rtol':2e-11,'atol':1e-13,'maxStep':1e-6,'nfev':result.nfev,'samples':[{'time':float(t),'states':flat.reshape(n,5).tolist()} for t,flat in zip(result.t,result.y.T)]}

paper=[dict(b) for b in fixtures['fourBall']['initial']]
flight=(paper[1]['x']-paper[0]['x']-2*radius)/paper[0]['vx']
for b in paper:b['x']+=b['vx']*flight;b['z']+=b['vz']*flight
chain=[{'id':0,'x':-2*radius,'z':0,'vx':4,'vz':0},{'id':1,'x':0,'z':0,'vx':0,'vz':0},{'id':2,'x':2*radius+1e-8,'z':0,'vx':0,'vz':0}]
report={'date':'2026-10-24','scope':'Independent numerical integration of reduced planar equations; not measured output or full paper reproduction','versions':{'numpy':np.__version__,'scipy':scipy.__version__},'material':m,'paperFreeFlightSeconds':flight,'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':[run('three-ball-chain',chain),run('paper-four-ball-planar',paper)]}
Path('validation/calibration/independent-reference.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'versions':report['versions'],'cases':[{k:c[k] for k in ['name','nfev']} for c in report['cases']]}))
