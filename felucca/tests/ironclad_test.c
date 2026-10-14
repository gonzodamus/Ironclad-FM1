/* IRONCLAD focused host checks. Uses the actual DSP sources; no hardware emulation claim. */
#define main upstream_hostsim_main
#include "hostsim.c"
#undef main

static int bad;
static void check(const char *what, int ok) {
    printf("ironclad: %s: %s\n", what, ok ? "PASS" : "FAIL"); bad += !ok;
}
static void insert_setup(int a, int b, int c, int mix) {
    memset(trk, 0, sizeof trk); memset(ins, 0, sizeof ins);
    host_tracks_init();
    trk[0].p[P_ITYPE] = 9;
    trk[0].p[P_IA] = a; trk[0].p[P_IB] = b; trk[0].p[P_IC] = c; trk[0].p[P_IMIX] = mix;
}
static void bypass(void) {
    int32_t x[CTL], original[CTL]; uint32_t i, k; int same = 1;
    insert_setup(127, 127, 127, 0);
    for (k = 0; k < 10; k++) {
        for (i = 0; i < CTL; i++) x[i] = original[i] = ((int32_t)(k*CTL+i)*997 % 100000)-50000;
        track_insert(&trk[0], x, CTL);
        same &= memcmp(x, original, sizeof x) == 0;
    }
    check("METAL MIX 0 preserves the input sample-for-sample", same);
}
static void corners(void) {
    uint32_t a, b, c, frame, i; int bounded = 1, tails = 1, dc_ok = 1; int32_t peak_all = 0, tail_all = 0;
    double worst_dc = 0;
    for(a=0;a<2;a++) for(b=0;b<2;b++) for(c=0;c<2;c++) {
        int32_t x[CTL], peak = 0, tail = 0; int64_t sum=0;
        insert_setup(a*127,b*127,c*127,127);
        for(frame=0;frame<2u*FS;frame+=CTL) {
            for(i=0;i<CTL;i++) x[i] = (int32_t)(120000*sin(2*3.141592653589793*110*(frame+i)/FS));
            track_insert(&trk[0],x,CTL);
            for(i=0;i<CTL;i++) {int32_t v=x[i]<0?-x[i]:x[i]; if(v>peak)peak=v; if(frame>FS)sum+=x[i];}
        }
        for(frame=0;frame<2u*FS;frame+=CTL) {
            memset(x,0,sizeof x); track_insert(&trk[0],x,CTL);
            if(frame>FS) for(i=0;i<CTL;i++){int32_t v=x[i]<0?-x[i]:x[i];if(v>tail)tail=v;}
        }
        double dc=fabs((double)sum/FS);
        if(peak>peak_all)peak_all=peak; if(tail>tail_all)tail_all=tail; if(dc>worst_dc)worst_dc=dc;
        bounded &= peak < 262144; tails &= tail < 16; dc_ok &= dc < 1500;
        printf("ironclad: corner DRIVE=%u CAB=%u LEVEL=%u peak=%d DC=%.2f tail=%d\n",a*127,b*127,c*127,peak,dc,tail);
    }
    check("all 8 parameter corners stay below internal headroom (262144)",bounded);
    check("all corners have DC below 1500 internal sample units",dc_ok);
    check("all corners settle below 16 units after one second of silence",tails);
    printf("ironclad: worst peak=%d, DC=%.2f, tail=%d\n",peak_all,worst_dc,tail_all);
}
static void silence(void) {
    int32_t x[CTL]; uint32_t frame,i; int zero=1;
    insert_setup(127,127,127,127);
    for(frame=0;frame<FS;frame+=CTL){ memset(x,0,sizeof x); track_insert(&trk[0],x,CTL);for(i=0;i<CTL;i++)zero&=x[i]==0;}
    check("maximum gain from fresh silence produces exact silence",zero);
}
int main(void) {
    check("METAL is appended at stored insert type 9",IT_N==10);
    if(IT_N!=10)return 1;
    bypass();silence();corners();
    printf("ironclad: %s\n",bad?"FAILED":"ALL FOCUSED CHECKS PASSED");
    return bad?1:0;
}
