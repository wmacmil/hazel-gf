concrete HazelGFGer of HazelGF = open SyntaxGer, (Syn = SyntaxGer), ParadigmsGer in {
  lincat
    S = Syn.S ; Cl = Syn.Cl ; NP = Syn.NP ; VP = Syn.VP ; CN = Syn.CN ;
    N = Syn.N ; V = Syn.V ; V2 = Syn.V2 ; Det = Syn.Det ;
    Pron = Syn.Pron ; Pol = Syn.Pol ; Temp = Syn.Temp ;
    Adv = Syn.Adv ; Prep = Syn.Prep ;

  lin
    MkS t p cl = mkS t p cl ; PredVP np vp = mkCl np vp ;
    UseV v = mkVP v ; ComplV2 v np = mkVP v np ;
    DetCN det cn = mkNP det cn ; UseN n = mkCN n ; UsePron p = mkNP p ;
    PrepNP p np = Syn.mkAdv p np ; AdvVP vp a = Syn.mkVP vp a ; AdvCN cn a = Syn.mkCN cn a ;

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
}
