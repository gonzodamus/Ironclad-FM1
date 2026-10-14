/* IRONCLAD focused integration using the real UI preset loader and stores. */
#define UI_TEST_NO_MAIN 1
#include "ui_test.c"
int main(void) {
    int failures=0;
    const uint8_t engines[3]={0,12,10};
    const uint8_t starts[3]={12,8,4};
    for(uint32_t g=0;g<3;g++) for(uint32_t p=starts[g];p<ENGINES[engines[g]]->npresets;p++) {
        ui_power_on();track_t *t=&trk[0];
        set_engine_of(t,engines[g]);t->p[P_LEVEL]=73;my_steps(t);step_t before[NSTEP];memcpy(before,t->step,sizeof before);
        apply_preset_to(t,p);
        const preset_t *pr=&ENGINES[engines[g]]->presets[p];
        int ok=t->p[P_LEVEL]==73 && !memcmp(before,t->step,sizeof before) && t->preset==p;
        if(pr->insert[0]){
            ok&=t->p[P_ITYPE]==9 && t->p[P_IMIX]==127;
            for(uint32_t i=0;i<3;i++)ok&=t->p[P_IA+i]==pr->insert[i+1];
        }
        if(pr->retrig)ok&=t->p[P_VOICE]==V_MONO;
        failures+=check(ENGINES[engines[g]]->presets[p].name,ok);
    }
    /* Dedicated six-operator voices use existing OWN storage: retain every
     * operator byte and macro through both real persistent paths. */
    for(uint32_t p=8;p<13;p++) {
        ui_power_on();song.sel=0;track_t *t=&trk[0];
        set_engine_of(t,ENGI_FM6);apply_preset_to(t,p);
        uint8_t voice[FP_SIZE];int16_t macro[7];
        memcpy(voice,fm6_patch[0],sizeof voice);
        voice[FP_ALG]=(voice[FP_ALG]+7u)%32u;
        voice[16]=voice[16]>13u?voice[16]-13u:voice[16]+13u;
        fm6_set_patch(0,voice);fm6_adopt(0);
        memcpy(voice,fm6_patch[0],sizeof voice);
        for(uint32_t i=0;i<7;i++)macro[i]=t->p[P_E0+i];
        int ok=t->p[P_E7]==FM6_OWN && fm6_slot[0]==FM6_OWN;
        for(uint32_t i=0;i<FM6_NFACTORY;i++) {
            uint8_t original[FP_SIZE+1];fm6_unpack(FM6_FACTORY[i],original);
            ok&=memcmp(voice,original,FP_SIZE)!=0;
        }
        ok&=project_save(0)==0;apply_preset_to(t,0);project_load(0);
        ok&=!memcmp(voice,fm6_patch[0],FP_SIZE) && t->p[P_E7]==FM6_OWN;
        for(uint32_t i=0;i<7;i++)ok&=t->p[P_E0+i]==macro[i];
        stop_transport();int rc=up_store(0,"IC VOICE");ok&=rc==0 || rc==3;
        apply_preset_to(t,0);up_load(0);
        ok&=!memcmp(voice,fm6_patch[0],FP_SIZE) && t->p[P_E7]==FM6_OWN;
        for(uint32_t i=0;i<7;i++)ok&=t->p[P_E0+i]==macro[i];
        failures+=check("edited IRONCLAD FM6 algorithm/operator voice: OWN, distinct, project + user preset round trips",ok);
        t->p[P_E7]=0;fm6_poll();
        uint8_t factory[FP_SIZE+1u];fm6_unpack(FM6_FACTORY[0],factory);
        failures+=check("IRONCLAD FM6 SLOT F1 honors selected legacy voice",!memcmp(factory,fm6_patch[0],FP_SIZE));
        t->p[P_E7]=FM6_OWN;fm6_poll();
        failures+=check("IRONCLAD FM6 SLOT OWN restores edited operator voice",!memcmp(voice,fm6_patch[0],FP_SIZE));
    }
    ui_power_on();track_t *t=&trk[0];set_engine_of(t,0);apply_preset_to(t,12);
    t->p[P_LEVEL]=73;
    int16_t keep[5];for(uint32_t i=0;i<5;i++)keep[i]=t->p[P_ITYPE+i];
    int ok=project_save(0)==0;
    apply_preset_to(t,0);project_load(0);
    for(uint32_t i=0;i<5;i++)ok&=t->p[P_ITYPE+i]==keep[i];
    ok&=t->p[P_LEVEL]==73;
    failures+=check("METAL insert survives project save / restore",ok);
    stop_transport();song.sel=0;
    int urc=up_store(0,"METAL QA");ok=(urc==0 || urc==3);
    apply_preset_to(t,0);t->p[P_LEVEL]=81;up_load(0);
    for(uint32_t i=0;i<5;i++)ok&=t->p[P_ITYPE+i]==keep[i];
    ok&=t->p[P_LEVEL]==81;
    failures+=check("METAL insert survives user-preset save / restore; mix LEVEL kept",ok);
    apply_preset_to(t,0);
    failures+=check("loading an original preset clears METAL and keeps mix LEVEL",t->p[P_ITYPE]==0 && t->p[P_LEVEL]==81);
    printf("ironclad-ui: %s\n",failures?"FAIL":"ALL FOCUSED CHECKS PASSED");
    return failures?1:0;
}
