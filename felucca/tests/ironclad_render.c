/* Host render of IRONCLAD's real firmware DSP, including appended factory fields. */
#define main upstream_hostsim_main
#include "hostsim.c"
#undef main
static void load(track_t *t, uint32_t eng, uint32_t preset) {
    const preset_t *p=&ENGINES[eng]->presets[preset];
    host_preset(t,eng,preset);
    if(p->insert[0]) {
        t->p[P_ITYPE]=p->insert[0];
        for(uint32_t i=0;i<3;i++) t->p[P_IA+i]=p->insert[i+1];
        t->p[P_IMIX]=127;
    }
    if(p->retrig)t->p[P_VOICE]=V_MONO;
}
int main(int argc,char **argv) {
    if(argc<4)return 2;
    uint32_t eng=atoi(argv[1]),preset=atoi(argv[2]);
    int drums=argc>4; const char *path=argv[3];
    uint32_t duration=18*FS, f, previous_step=~0u, last_note=0;
    int32_t peak=0,tail=0; uint32_t over=0; int64_t sum=0;
    FILE *w=fopen(path,"wb");if(!w)return 3;
    host_tracks_init(); load(&trk[0],eng,preset);
    song.master_q12=4096;
    if(drums){host_preset(&trk[3],ENGI_DRUM,4);trk[3].p[P_CHOR]=trk[3].p[P_DLY]=trk[3].p[P_REV]=0;}
    wav_hdr(w,duration);
    for(f=0;f<duration;f+=CTL){
        int32_t o[2*CTL];
        uint32_t step=(uint32_t)((uint64_t)f*160*4/(FS*60));
        uint32_t within=(uint32_t)((uint64_t)f*160*4%(FS*60));
        if(step<64){
            if(step!=previous_step){
                static const uint8_t riff[16]={28,28,0,28,31,28,0,34,28,28,40,0,27,27,31,0};
                if(last_note)trk_note_off(&trk[0],last_note);
                last_note=riff[step%16];
                if(eng==12 && preset==10)last_note=last_note?last_note+24:0;
                if(eng==12 && preset==11)last_note=last_note?last_note+24:0;
                if(last_note)trk_note_on(&trk[0],last_note,step%4?110:127);
                if(drums){trk_note_on(&trk[3],42,70);if(step%4==0)trk_note_on(&trk[3],36,120);if(step%8==4)trk_note_on(&trk[3],38,110);}
                previous_step=step;
            }
            if(within>FS*60*62/100 && last_note){trk_note_off(&trk[0],last_note);last_note=0;}
        }else if(last_note){trk_note_off(&trk[0],last_note);last_note=0;}
        mix_block(o,CTL);
        for(uint32_t i=0;i<CTL && f+i<duration;i++){
            for(uint32_t k=0;k<2;k++){
                int32_t x=o[2*i+k],a=x<0?-x:x;
                if(a>peak)peak=a;over+=a>32767;
                if(f<6*FS)sum+=x;
                if(f>duration-FS/4 && a>tail)tail=a;
            }
            wav_put(w,o[2*i],o[2*i+1]);
        }
    }
    fclose(w);
    uint32_t busy=busy_now();
    printf("%s %s: peak=%d over16bit=%u DC=%.2f final250ms_peak=%d active_voices=%u\n",ENGINES[eng]->name,ENGINES[eng]->presets[preset].name,peak,over,(double)sum/(12*FS),tail,busy);
    return over || peak>=30000 || tail>6 || busy ? 1:0;
}
