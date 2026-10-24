"""Plots our computed traces against the independent ODE reference, not paper figures."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
reference=json.loads(Path('validation/calibration/independent-reference.json').read_text())
results=json.loads(Path('validation/calibration/numerical.json').read_text())
fig,axes=plt.subplots(2,2,figsize=(12,7),constrained_layout=True)
for row,(ref,result) in enumerate(zip(reference['cases'],results['cases'])):
 t=[s['time']*1e3 for s in ref['samples']];ax=axes[row,0]
 for body in range(len(ref['initial'])):
  line=ax.plot(t,[s['states'][body][2] for s in ref['samples']],label=f'Body {body} ODE')[0]
  ax.plot(t[::10],[s['states'][body][2] for s in result['coarse']['samples'][::10]],'.',color=line.get_color(),markersize=3)
 ax.set(title=ref['name'],xlabel='Time since first contact (ms)',ylabel='X velocity (m/s)');ax.grid(alpha=.2);ax.legend(fontsize=7)
 ax=axes[row,1];samples=result['coarse']['samples'];t=[s['time']*1e3 for s in samples]
 for k in ['kinetic','elastic']:ax.plot(t,[s[k] for s in samples],label=k)
 ax.plot(t,[s['kinetic']+s['elastic'] for s in samples],label='total',linewidth=2)
 ax.set(xlabel='Time since first contact (ms)',ylabel='Energy (J)');ax.grid(alpha=.2);ax.legend()
fig.suptitle('Reduced planar contact validation: DOP853 lines / TypeScript markers')
fig.savefig('validation/calibration/contact-reference.png',dpi=160)
