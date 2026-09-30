concrete HazelGFEng of HazelGF = open SyntaxEng, (Syn = SyntaxEng), ParadigmsEng in {
  lincat
    S = Syn.S ; Cl = Syn.Cl ; NP = Syn.NP ; VP = Syn.VP ; CN = Syn.CN ;
    N = Syn.N ; V = Syn.V ; V2 = Syn.V2 ; Det = Syn.Det ;
    Pron = Syn.Pron ; Pol = Syn.Pol ; Temp = Syn.Temp ;
    Adv = Syn.Adv ; Prep = Syn.Prep ;
    A = Syn.A ; AP = Syn.AP ; AdA = Syn.AdA ; Conj = Syn.Conj ;

  lin
    MkS t p cl = mkS t p cl ;
    PredVP np vp = mkCl np vp ;
    UseV v = mkVP v ;
    ComplV2 v np = mkVP v np ;
    DetCN det cn = mkNP det cn ;
    UseN n = mkCN n ;
    UsePron p = mkNP p ;
    PrepNP p np = Syn.mkAdv p np ; AdvVP vp a = Syn.mkVP vp a ; AdvCN cn a = Syn.mkCN cn a ;
    PositA a = Syn.mkAP a ; AdAP ada ap = Syn.mkAP ada ap ; AdjCN ap cn = Syn.mkCN ap cn ;
    ComparA a np = Syn.mkAP a np ; UseComparA a = Syn.comparAP a ;
    UseAP ap = Syn.mkVP ap ; ExistNP np = Syn.mkCl np ;
    ConjNP c x y = Syn.mkNP c x y ; ConjS c x y = Syn.mkS c x y ;

    Present = mkTemp presentTense simultaneousAnt ;
    Past = mkTemp pastTense simultaneousAnt ;
    Future = mkTemp futureTense simultaneousAnt ;
    Conditional = mkTemp conditionalTense simultaneousAnt ;
    PresentPerfect = mkTemp presentTense anteriorAnt ;
    PastPerfect = mkTemp pastTense anteriorAnt ;
    FuturePerfect = mkTemp futureTense anteriorAnt ;
    ConditionalPerfect = mkTemp conditionalTense anteriorAnt ;
    TableN = mkN "table" ; GardenN = mkN "garden" ; CityN = mkN "city" "cities" ;
    InPrep = in_Prep ; OnPrep = on_Prep ; WithPrep = with_Prep ; ToPrep = to_Prep ; UnderPrep = under_Prep ;
    BirdN = mkN "bird" ; ChildN = mkN "child" "children" ; AppleN = mkN "apple" ;
    CarN = mkN "car" ; FriendN = mkN "friend" ; TeacherN = mkN "teacher" ;
    SingV = mkV "sing" "sang" "sung" "singing" ; SwimV = mkV "swim" "swam" "swum" "swimming" ;
    ComeV = mkV "come" "came" "come" "coming" ;
    EatV2 = mkV2 (mkV "eat" "ate" "eaten" "eating") ; BuyV2 = mkV2 (mkV "buy" "bought" "bought" "buying") ;
    HelpV2 = mkV2 "help" ;
    BigA = mkA "big" "bigger" ; SmallA = mkA "small" ; OldA = mkA "old" ; RedA = mkA "red" "redder" ;
    HappyA = mkA "happy" ; GoodA = mkA "good" "better" "best" "well" ;
    HereAdv = here_Adv ; TodayAdv = ParadigmsEng.mkAdv "today" ; OftenAdv = ParadigmsEng.mkAdv "often" ;
    VeryAdA = very_AdA ; EveryDet = every_Det ; SomeDet = someSg_Det ;
    AndConj = and_Conj ; OrConj = or_Conj ;
    Positive = positivePol ; Negative = negativePol ;
    Definite = the_Det ; Indefinite = a_Det ;
    IPron = i_Pron ; YouPron = youSg_Pron ; HePron = he_Pron ;
    ShePron = she_Pron ; WePron = we_Pron ; TheyPron = they_Pron ;

    ManN = mkN "man" "men" ; WomanN = mkN "woman" "women" ;
    HouseN = mkN "house" ; DogN = mkN "dog" ; CatN = mkN "cat" ;
    BookN = mkN "book" ;
    SleepV = mkV "sleep" "slept" "slept" "sleeping" ; WalkV = mkV "walk" ;
    RunV = mkV "run" "ran" "run" "running" ;
    SeeV2 = mkV2 (mkV "see" "saw" "seen") ;
    LoveV2 = mkV2 "love" ; ReadV2 = mkV2 (mkV "read" "read" "read") ;

    HoleS = mkS (mkCl (mkNP (mkPN "⟦S⟧")) (mkVP (mkV "wait"))) ;
    HoleCl = mkCl (mkNP (mkPN "⟦Cl⟧")) (mkVP (mkV "wait")) ;
    HoleNP = mkNP (mkPN "⟦NP⟧") ; HoleVP = mkVP (mkV "⟦VP⟧") ;
    HoleCN = mkCN (mkN "⟦CN⟧") ; HoleN = mkN "⟦N⟧" ;
    HoleV = mkV "⟦V⟧" ; HoleV2 = mkV2 "⟦V2⟧" ;
    HoleDet = the_Det ; HolePron = i_Pron ; HolePol = positivePol ; HoleTemp = mkTemp presentTense simultaneousAnt ;
    HoleAdv = ParadigmsEng.mkAdv "⟦Adv⟧" ; HolePrep = in_Prep ;
    HoleA = ParadigmsEng.mkA "⟦A⟧" ; HoleAP = Syn.mkAP (ParadigmsEng.mkA "⟦AP⟧") ; HoleAdA = very_AdA ; HoleConj = and_Conj ;
}
