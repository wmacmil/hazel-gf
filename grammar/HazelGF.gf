abstract HazelGF = {
  flags startcat = S ;

  cat
    S ; Cl ; NP ; VP ; CN ; N ; V ; V2 ; Det ; Pron ; Pol ;

  fun
    MkS       : Pol -> Cl -> S ;
    PredVP    : NP -> VP -> Cl ;
    UseV      : V -> VP ;
    ComplV2   : V2 -> NP -> VP ;
    DetCN     : Det -> CN -> NP ;
    UseN      : N -> CN ;
    UsePron   : Pron -> NP ;

    Positive, Negative : Pol ;
    Definite, Indefinite : Det ;
    IPron, YouPron, HePron, ShePron, WePron, TheyPron : Pron ;

    ManN, WomanN, HouseN, DogN, CatN, BookN : N ;
    SleepV, WalkV, RunV : V ;
    SeeV2, LoveV2, ReadV2 : V2 ;

    -- Reserved for serialization and future server-side partial previews.
    -- The browser owns incomplete terms and hides these from the palette.
    HoleS : S ; HoleCl : Cl ; HoleNP : NP ; HoleVP : VP ;
    HoleCN : CN ; HoleN : N ; HoleV : V ; HoleV2 : V2 ;
    HoleDet : Det ; HolePron : Pron ; HolePol : Pol ;
}
