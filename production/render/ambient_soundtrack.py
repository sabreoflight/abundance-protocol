import numpy as np, wave
SR=44100; DUR=300; N=SR*DUR
t=np.arange(N)/SR
rng=np.random.default_rng(64)
def hz(m): return 440*2**((m-69)/12)
# chord pads (midi), ~37s each, crossfaded
chords=[[38,45,52,57,61],[40,47,54,59,62],[43,50,54,57,62],[36,43,50,55,59],[38,45,50,57,64]]
seg=DUR/len(chords)
L=np.zeros(N);R=np.zeros(N)
for ci,ch in enumerate(chords):
    c0=ci*seg; c1=(ci+1)*seg
    env=np.clip((t-(c0-8))/10,0,1)*np.clip(((c1+8)-t)/10,0,1)
    env=np.sin(env*np.pi/2)
    if ci==0: env=np.clip(t/8,0,1)*np.clip((c1+8-t)/10,0,1)
    if ci==len(chords)-1: env=np.clip((t-(c0-8))/10,0,1)*np.clip((DUR-t)/10,0,1)
    for k,m in enumerate(ch):
        f=hz(m)
        for side,det in ((0,0.998),(1,1.002)):
            lfo=0.75+0.25*np.sin(2*np.pi*(0.04+0.013*k)*t+k+side)
            w=np.sin(2*np.pi*f*det*t)+0.35*np.sin(2*np.pi*2*f*det*t+1)+0.12*np.sin(2*np.pi*3*f*det*t)
            amp=0.05/(1+0.35*k)
            (R if side else L)[:]+=amp*env*lfo*w
# chimes: soft bell tones through a convolution reverb
pent=[74,78,81,83,86,90]
chime_l=np.zeros(N);chime_r=np.zeros(N)
def bell(t0,m,vel=0.07):
    i0=int(t0*SR);n=int(7*SR);tt=np.arange(n)/SR;f=hz(m)
    s=(np.sin(2*np.pi*f*tt)+0.4*np.sin(2*np.pi*f*2.01*tt)+0.15*np.sin(2*np.pi*f*3.97*tt))*np.exp(-tt/1.8)*np.minimum(1,tt/0.02)
    n=min(n,N-i0)
    if n<=0:return
    p=rng.uniform(-.5,.5);chime_l[i0:i0+n]+=vel*s[:n]*(1-p)/1.5;chime_r[i0:i0+n]+=vel*s[:n]*(1+p)/1.5
tm=6.0
while tm<DUR-12:
    bell(tm,int(rng.choice(pent)),0.05);tm+=rng.uniform(7,13)
for ts in (20,55,95,130,170,205,245,290):  # section markers
    bell(ts+0.2,74,0.11);bell(ts+0.9,81,0.08);bell(ts+1.6,86,0.06)
# reverb (FFT conv) with decaying noise IR
irn=int(3.2*SR);ir=rng.standard_normal((2,irn))*np.exp(-np.arange(irn)/SR/0.9);ir[:,:int(.02*SR)]*=np.linspace(0,1,int(.02*SR))
ir/=np.sqrt((ir**2).sum(axis=1,keepdims=True))
def conv(x,h):
    n=1
    while n<len(x)+len(h):n*=2
    return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(h,n),n)[:len(x)]
wl=conv(chime_l,ir[0]);wr=conv(chime_r,ir[1])
L+=0.55*chime_l+0.9*wl;R+=0.55*chime_r+0.9*wr
fade=np.clip(t/3,0,1)*np.clip((DUR-t)/6,0,1)
L*=fade;R*=fade
m=max(np.abs(L).max(),np.abs(R).max());g=0.42/m
out=np.stack([L*g,R*g],axis=1)
pcm=(out*32767).astype('<i2')
with wave.open('ambient8.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
print('done',out.shape)
