concrete HazelGFFre of HazelGF = open SyntaxFre, (Syn = SyntaxFre), ParadigmsFre, (I = IrregFre) in {
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

    -- Every noun with its gender: the heuristic (feminine if it ends in -e) is wrong for livre, and irregular plurals are explicit.
    ManN = mkN "homme" masculine ; WomanN = mkN "femme" feminine ;
    HouseN = mkN "maison" feminine ; DogN = mkN "chien" masculine ; CatN = mkN "chat" masculine ;
    BookN = mkN "livre" masculine ;
    TableN = mkN "table" feminine ; GardenN = mkN "jardin" masculine ; CityN = mkN "ville" feminine ;
    BirdN = mkN "oiseau" "oiseaux" masculine ; ChildN = mkN "enfant" masculine ; AppleN = mkN "pomme" feminine ;
    CarN = mkN "voiture" feminine ; FriendN = mkN "ami" masculine ; TeacherN = mkN "professeur" masculine ;

    -- Irregular verbs from the RGL's Bescherelle tables; venir takes être.
    SleepV = I.dormir_V ; WalkV = mkV "marcher" ; RunV = I.courir_V ;
    SingV = mkV "chanter" ; SwimV = mkV "nager" ; ComeV = I.venir_V ;
    SeeV2 = I.voir_V2 ; LoveV2 = mkV2 (mkV "aimer") ; ReadV2 = I.lire_V2 ;
    EatV2 = mkV2 (mkV "manger") ; BuyV2 = mkV2 (mkV "acheter" "achète" "achetons" "achètent" "acheta" "achètera" "acheté") ; HelpV2 = mkV2 (mkV "aider") ;

    -- grand, petit, vieux, bon precede the noun; bon compares as meilleur.
    BigA = prefixA (mkA "grand") ; SmallA = prefixA (mkA "petit") ;
    OldA = prefixA (mkA "vieux" "vieil" "vieille" "vieux" "vieillement") ; RedA = mkA "rouge" ;
    HappyA = mkA "heureux" "heureuse" ; GoodA = prefixA (mkA (mkA "bon" "bonne") (mkA "meilleur")) ;

    HereAdv = ParadigmsFre.mkAdv "ici" ; TodayAdv = ParadigmsFre.mkAdv "aujourd'hui" ; OftenAdv = ParadigmsFre.mkAdv "souvent" ;
    VeryAdA = very_AdA ; EveryDet = every_Det ; SomeDet = someSg_Det ;
    AndConj = and_Conj ; OrConj = or_Conj ;
    InPrep = in_Prep ; OnPrep = on_Prep ; WithPrep = with_Prep ; ToPrep = dative ; UnderPrep = under_Prep ;
    Positive = positivePol ; Negative = negativePol ;
    Definite = the_Det ; Indefinite = a_Det ;
    IPron = i_Pron ; YouPron = youSg_Pron ; HePron = he_Pron ;
    ShePron = she_Pron ; WePron = we_Pron ; TheyPron = they_Pron ;

    HoleS = mkS (mkCl (mkNP (mkPN "⟦S⟧")) (mkVP (mkV "attendre"))) ;
    HoleCl = mkCl (mkNP (mkPN "⟦Cl⟧")) (mkVP (mkV "attendre")) ;
    HoleNP = mkNP (mkPN "⟦NP⟧") ; HoleVP = mkVP (mkV "⟦VP⟧er") ;
    HoleCN = mkCN (mkN "⟦CN⟧") ; HoleN = mkN "⟦N⟧" ;
    HoleV = mkV "⟦V⟧er" ; HoleV2 = mkV2 (mkV "⟦V2⟧er") ;
    HoleDet = the_Det ; HolePron = i_Pron ; HolePol = positivePol ; HoleTemp = mkTemp presentTense simultaneousAnt ;
    HoleAdv = ParadigmsFre.mkAdv "⟦Adv⟧" ; HolePrep = in_Prep ;
    HoleA = ParadigmsFre.mkA "⟦A⟧" ; HoleAP = Syn.mkAP (ParadigmsFre.mkA "⟦AP⟧") ; HoleAdA = very_AdA ; HoleConj = and_Conj ;
}
