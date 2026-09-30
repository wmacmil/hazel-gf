concrete HazelGFGer of HazelGF = open SyntaxGer, (Syn = SyntaxGer), ParadigmsGer in {
  lincat
    S = Syn.S ; Cl = Syn.Cl ; NP = Syn.NP ; VP = Syn.VP ; CN = Syn.CN ;
    N = Syn.N ; V = Syn.V ; V2 = Syn.V2 ; Det = Syn.Det ;
    Pron = Syn.Pron ; Pol = Syn.Pol ; Temp = Syn.Temp ;
    Adv = Syn.Adv ; Prep = Syn.Prep ;
    A = Syn.A ; AP = Syn.AP ; AdA = Syn.AdA ; Conj = Syn.Conj ;

  lin
    MkS t p cl = mkS t p cl ; PredVP np vp = mkCl np vp ;
    UseV v = mkVP v ; ComplV2 v np = mkVP v np ;
    DetCN det cn = mkNP det cn ; UseN n = mkCN n ; UsePron p = mkNP p ;
    PrepNP p np = Syn.mkAdv p np ; AdvVP vp a = Syn.mkVP vp a ; AdvCN cn a = Syn.mkCN cn a ;
    PositA a = Syn.mkAP a ; AdAP ada ap = Syn.mkAP ada ap ; AdjCN ap cn = Syn.mkCN ap cn ;
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
    TableN = mkN "Tisch" "Tische" masculine ;
    GardenN = mkN "Garten" "Gärten" masculine ;
    CityN = mkN "Stadt" "Städte" feminine ;
    -- in/zu contract with the article: im, zum, zur.
    InPrep = inDat_Prep ; OnPrep = on_Prep ; WithPrep = with_Prep ; ToPrep = zu_Prep ; UnderPrep = under_Prep ;
    BirdN = mkN "Vogel" "Vögel" masculine ; ChildN = mkN "Kind" "Kinder" neuter ;
    AppleN = mkN "Apfel" "Äpfel" masculine ; CarN = mkN "Auto" "Autos" neuter ;
    FriendN = mkN "Freund" "Freunde" masculine ; TeacherN = mkN "Lehrer" "Lehrer" masculine ;
    SingV = mkV "singen" "singt" "sang" "sänge" "gesungen" ;
    SwimV = seinV (mkV "schwimmen" "schwimmt" "schwamm" "schwämme" "geschwommen") ;
    ComeV = seinV (mkV "kommen" "kommt" "kam" "käme" "gekommen") ;
    EatV2 = mkV2 (mkV "essen" "isst" "aß" "äße" "gegessen") ; BuyV2 = mkV2 (mkV "kaufen") ;
    -- helfen governs the dative: ich helfe dem Mann.
    HelpV2 = mkV2 (mkV "helfen" "hilft" "half" "hülfe" "geholfen") dative ;
    BigA = mkA "groß" "größer" "größte" ; SmallA = mkA "klein" ; OldA = mkA "alt" "älter" "älteste" ;
    RedA = mkA "rot" ; HappyA = mkA "glücklich" ; GoodA = mkA "gut" "besser" "beste" ;
    HereAdv = here_Adv ; TodayAdv = ParadigmsGer.mkAdv "heute" ; OftenAdv = ParadigmsGer.mkAdv "oft" ;
    VeryAdA = very_AdA ; EveryDet = every_Det ; SomeDet = someSg_Det ;
    AndConj = and_Conj ; OrConj = or_Conj ;
    Positive = positivePol ; Negative = negativePol ;
    Definite = the_Det ; Indefinite = a_Det ;
    IPron = i_Pron ; YouPron = youSg_Pron ; HePron = he_Pron ;
    ShePron = she_Pron ; WePron = we_Pron ; TheyPron = they_Pron ;

    ManN = mkN "Mann" "Männer" masculine ;
    WomanN = mkN "Frau" "Frauen" feminine ;
    HouseN = mkN "Haus" "Häuser" neuter ;
    DogN = mkN "Hund" "Hunde" masculine ;
    CatN = mkN "Katze" "Katzen" feminine ;
    BookN = mkN "Buch" "Bücher" neuter ;
    SleepV = mkV "schlafen" "schläft" "schlief" "schliefe" "geschlafen" ;
    WalkV = seinV (mkV "gehen" "geht" "ging" "ginge" "gegangen") ;
    RunV = seinV (mkV "laufen" "läuft" "lief" "liefe" "gelaufen") ;
    SeeV2 = mkV2 (mkV "sehen" "sieht" "sah" "sähe" "gesehen") ;
    LoveV2 = mkV2 "lieben" ;
    ReadV2 = mkV2 (mkV "lesen" "liest" "las" "läse" "gelesen") ;

    HoleS = mkS (mkCl (mkNP (mkPN "⟦S⟧")) (mkVP (mkV "warten"))) ;
    HoleCl = mkCl (mkNP (mkPN "⟦Cl⟧")) (mkVP (mkV "warten")) ;
    HoleNP = mkNP (mkPN "⟦NP⟧") ; HoleVP = mkVP (mkV "warten") ;
    HoleCN = mkCN (mkN "⟦CN⟧") ; HoleN = mkN "⟦N⟧" ;
    HoleV = mkV "warten" ; HoleV2 = mkV2 "sehen" ;
    HoleDet = the_Det ; HolePron = i_Pron ; HolePol = positivePol ; HoleTemp = mkTemp presentTense simultaneousAnt ;
    HoleAdv = ParadigmsGer.mkAdv "⟦Adv⟧" ; HolePrep = in_Prep ;
    HoleA = ParadigmsGer.mkA "⟦A⟧" ; HoleAP = Syn.mkAP (ParadigmsGer.mkA "⟦AP⟧") ; HoleAdA = very_AdA ; HoleConj = and_Conj ;
}
