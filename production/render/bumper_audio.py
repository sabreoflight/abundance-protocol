import numpy as np,wave
SR=44100
def hz(m):return 440*2**((m-69)/12)
def make(dur,name,bells):
    N=int(SR*dur);t=np.arange(N)/SR;L=np.zeros(N);R=np.zeros(N)
    env=np.clip(t/1.5,0,1)*np.clip((dur-t)/2.0,0,1)
    for k,m in enumerate([38,45,52,57,61]):
        f=hz(m)
        for side,det in((0,.998),(1,1.002)):
            w=np.sin(2*np.pi*f*det*t)+.35*np.sin(2*np.pi*2*f*det*t+1)
            (R if side else L)[:]+=.06/(1+.35*k)*env*w
    for t0,m,v in bells:
        i0=int(t0*SR);n=min(int(6*SR),N-i0);tt=np.arange(n)/SR;f=hz(m)
        s=(np.sin(2*np.pi*f*tt)+.4*np.sin(2*np.pi*f*2.01*tt))*np.exp(-tt/1.6)*np.minimum(1,tt/.02)*v
        L[i0:i0+n]+=s;R[i0:i0+n]+=s
    m=max(abs(L).max(),abs(R).max());g=.42/m
    out=(np.stack([L,R],1)*g*32767).astype('<i2')
    with wave.open(name,'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(out.tobytes())
make(7,'in.wav',[(.4,74,.12),(1.1,81,.09),(1.8,86,.07)])
make(10,'out.wav',[(.6,74,.1),(1.4,81,.08),(2.2,86,.06)])
