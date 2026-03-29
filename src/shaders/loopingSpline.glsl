// 循环样条曲线动画效果
// Author: Sébastien Bérubé
// Created: Oct 2014
// Modified: Jan 2016

const int POINT_COUNT = 8;
struct CtrlPts
{
    vec2 p[POINT_COUNT];
};

vec2 PointArray(int i, CtrlPts ctrlPts)
{
    if(i==0 || i==POINT_COUNT  ) return ctrlPts.p[0];
    if(i==1 || i==POINT_COUNT+1) return ctrlPts.p[1];
    if(i==2 || i==POINT_COUNT+2) return ctrlPts.p[2];
    if(i==3) return ctrlPts.p[3];
    if(i==4) return ctrlPts.p[4];
    if(i==5) return ctrlPts.p[5];
    if(i==6) return ctrlPts.p[6];
    if(i==7) return ctrlPts.p[7];
    return vec2(0);
}

vec2 catmullRom(float fTime, CtrlPts ctrlPts)
{
    float t = fTime;
    const float n = float(POINT_COUNT);
    
    int idxOffset = int(t*n);
    vec2 p1 = PointArray(idxOffset,ctrlPts);
    vec2 p2 = PointArray(idxOffset+1,ctrlPts);
    vec2 p3 = PointArray(idxOffset+2,ctrlPts);
    vec2 p4 = PointArray(idxOffset+3,ctrlPts);
    
    t *= n;
    t = (t-float(int(t)));
    
    vec2 val = 0.5 * ((-p1 + 3.*p2 -3.*p3 + p4)*t*t*t
               + (2.*p1 -5.*p2 + 4.*p3 - p4)*t*t
               + (-p1+p3)*t
               + 2.*p2);
    return val;
}

float distanceToLineSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 ap = p-a;
    vec2 ab = b-a;
    vec2 e = a+clamp(dot(ap,ab)/dot(ab,ab),0.0,1.0)*ab;
    return length(p-e);
}

vec2 debugDistanceField(vec2 uv, CtrlPts ctrlPts)
{
    const float MAX_DIST = 10000.0;
    float bestX = 0.0;
    
    const int iter = POINT_COUNT*2+1;
    float primarySegLength = 1.0/float(iter-1);
    vec2 pA = catmullRom(0., ctrlPts);
    float minRoughDist = MAX_DIST;
    float x = 0.0;
    for(int i=0; i < iter; ++i)
    {
        vec2 pB = catmullRom(x, ctrlPts);
        
        float d = distanceToLineSeg(uv, pA, pB);
        pA = pB;
        if(d<minRoughDist)
        {
            bestX = x;
            minRoughDist = d;
        }
         
        x += primarySegLength;
        x = min(x,0.99999);
    }
    
    const int iter2 = 14;
    x = max(bestX-1.25*primarySegLength,0.0);
    float minDist = MAX_DIST;
    pA = catmullRom(x, ctrlPts);
    for(int i=0; i < iter2; ++i)
    {
        vec2 pB = catmullRom(x, ctrlPts);
        float d = distanceToLineSeg(uv, pA, pB);
        pA = pB;
        
        if(d<minDist)
        {
            bestX = x;
            minDist = d;
        }
         
        x += 1.5/float(iter2-1)*primarySegLength;
        x = min(x,0.99999);
    }
    
    return vec2(minDist,minRoughDist);
}

vec2 getUV(vec2 px)
{
    vec2 uv = px / iResolution.xx;
    return uv;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    CtrlPts ctrlPts;
    ctrlPts.p[0] = vec2(0.10,0.25);
    ctrlPts.p[1] = vec2(0.2,0.1);
    ctrlPts.p[2] = vec2(0.6,0.35);
    ctrlPts.p[3] = vec2(0.4,0.1);
    ctrlPts.p[4] = vec2(0.8,0.35);
    ctrlPts.p[5] = vec2(0.6,0.55);
    ctrlPts.p[6] = vec2(0.5,0.45);
    ctrlPts.p[7] = vec2(0.3,0.49);
    
    if(iMouse.z > 0.1)
        ctrlPts.p[2] = getUV(iMouse.xy);
    vec2 uv = getUV(fragCoord.xy);
    
    float fTime = iTime*0.15;
    vec2 pA = catmullRom(fract(fTime), ctrlPts);
    vec2 pB = catmullRom(fract(fTime+0.02), ctrlPts);
    
    vec2 dSeg = debugDistanceField(uv, ctrlPts);
    
    vec3 c = vec3(dSeg.x*7.0+smoothstep(0.20,0.3,abs(fract(dSeg.x*20.0)-0.5)));
    
    c = mix(vec3(0,0.8,0.9),c,smoothstep(-0.005,0.0035,dSeg.y));
    c = mix(vec3(1,0  ,0.0),c,smoothstep(0.0,0.0025,dSeg.x));
    
    float minDistP = 10000.0;
    for(int i=0; i < POINT_COUNT; ++i)
    {
        vec2 ctrl_pt = PointArray(i,ctrlPts);
        minDistP = min(length(uv-ctrl_pt),minDistP);
    }
    c = mix(vec3(0,0,1),c,smoothstep(0.008,0.011,minDistP));
    
    c = mix(vec3(0,0.7,0),c,smoothstep(0.008,0.011,length(uv-pA)));
    c = mix(vec3(0,0.7,0),c,smoothstep(0.008,0.011,length(uv-pB)));
    c = mix(vec3(1,1,1),c,smoothstep(0.004,0.006,length(uv-pB)));
    
    fragColor = vec4(c,1);
}
