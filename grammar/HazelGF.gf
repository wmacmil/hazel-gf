abstract HazelGF = {
  flags startcat = S ;

  cat
    S ; Cl ; NP ; VP ; CN ; N ; V ; V2 ; Det ; Pron ; Pol ; Temp ; Adv ; Prep ;
    A ; AP ; AdA ; Conj ;

  fun
    MkS       : Temp -> Pol -> Cl -> S ;
    PredVP    : NP -> VP -> Cl ;
    UseV      : V -> VP ;
    ComplV2   : V2 -> NP -> VP ;
    DetCN     : Det -> CN -> NP ;
    UseN      : N -> CN ;
    UsePron   : Pron -> NP ;
    PrepNP    : Prep -> NP -> Adv ;   -- in the house
    AdvVP     : VP -> Adv -> VP ;     -- sleeps in the house (recursive)
    AdvCN     : CN -> Adv -> CN ;     -- woman with the dog (recursive)
    PositA    : A -> AP ;             -- big
    AdAP      : AdA -> AP -> AP ;     -- very big
    ComparA   : A -> NP -> AP ;       -- bigger than the dog
    UseComparA : A -> AP ;            -- bigger
    AdjCN     : AP -> CN -> CN ;      -- big dog
    UseAP     : AP -> VP ;            -- is big
    ExistNP   : NP -> Cl ;            -- there is a dog / es gibt einen Hund
    ConjNP    : Conj -> NP -> NP -> NP ;  -- the man and the woman
    ConjS     : Conj -> S -> S -> S ;     -- I sleep and you run

    Positive, Negative : Pol ;
    Present, Past, Future, Conditional : Temp ;
    PresentPerfect, PastPerfect, FuturePerfect, ConditionalPerfect : Temp ;
    Definite, Indefinite : Det ;
    IPron, YouPron, HePron, ShePron, WePron, TheyPron : Pron ;

    ManN, WomanN, HouseN, DogN, CatN, BookN : N ;
    TableN, GardenN, CityN : N ;
    BirdN, ChildN, AppleN, CarN, FriendN, TeacherN : N ;
    SingV, SwimV, ComeV : V ;
    EatV2, BuyV2, HelpV2 : V2 ;
    BigA, SmallA, OldA, RedA, HappyA, GoodA : A ;
    HereAdv, TodayAdv, OftenAdv : Adv ;
    VeryAdA : AdA ;
    EveryDet, SomeDet : Det ;
    AndConj, OrConj : Conj ;
    InPrep, OnPrep, WithPrep, ToPrep, UnderPrep : Prep ;
    SleepV, WalkV, RunV : V ;
    SeeV2, LoveV2, ReadV2 : V2 ;

    -- Reserved for serialization and future server-side partial previews.
    -- The browser owns incomplete terms and hides these from the palette.
    HoleS : S ; HoleCl : Cl ; HoleNP : NP ; HoleVP : VP ;
    HoleCN : CN ; HoleN : N ; HoleV : V ; HoleV2 : V2 ;
    HoleDet : Det ; HolePron : Pron ; HolePol : Pol ; HoleTemp : Temp ;
    HoleAdv : Adv ; HolePrep : Prep ;
    HoleA : A ; HoleAP : AP ; HoleAdA : AdA ; HoleConj : Conj ;
}
