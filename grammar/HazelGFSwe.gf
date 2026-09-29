concrete HazelGFSwe of HazelGF = open SyntaxSwe, (Syn = SyntaxSwe), ParadigmsSwe in {
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
    TableN = mkN "bord" "bordet" "bord" "borden" neutrum ;
    GardenN = mkN "trädgård" "trädgården" "trädgårdar" "trädgårdarna" utrum ;
    CityN = mkN "stad" "staden" "städer" "städerna" utrum ;
    InPrep = in_Prep ; OnPrep = on_Prep ; WithPrep = with_Prep ; ToPrep = to_Prep ; UnderPrep = under_Prep ;
    Positive = positivePol ; Negative = negativePol ;
    Definite = the_Det ; Indefinite = a_Det ;
    IPron = i_Pron ; YouPron = youSg_Pron ; HePron = he_Pron ;
    ShePron = she_Pron ; WePron = we_Pron ; TheyPron = they_Pron ;

    ManN = mkN "man" "mannen" "män" "männen" utrum ;
    WomanN = mkN "kvinna" "kvinnan" "kvinnor" "kvinnorna" utrum ;
    HouseN = mkN "hus" "huset" "hus" "husen" neutrum ;
    DogN = mkN "hund" "hunden" "hundar" "hundarna" utrum ;
    CatN = mkN "katt" "katten" "katter" "katterna" utrum ;
    BookN = mkN "bok" "boken" "böcker" "böckerna" utrum ;
    SleepV = mkV "sova" "sov" "sovit" ; WalkV = mkV "gå" "gick" "gått" ;
    RunV = mkV "springa" "sprang" "sprungit" ;
    SeeV2 = mkV2 (mkV "se" "såg" "sett") ;
    LoveV2 = mkV2 "älskar" ; ReadV2 = mkV2 (mkV "läsa" "läste" "läst") ;

    HoleS = mkS (mkCl (mkNP (mkPN "⟦S⟧")) (mkVP (mkV "väntar"))) ;
    HoleCl = mkCl (mkNP (mkPN "⟦Cl⟧")) (mkVP (mkV "väntar")) ;
    HoleNP = mkNP (mkPN "⟦NP⟧") ; HoleVP = mkVP (mkV "⟦VP⟧") ;
    HoleCN = mkCN (mkN "⟦CN⟧") ; HoleN = mkN "⟦N⟧" ;
    HoleV = mkV "⟦V⟧" ; HoleV2 = mkV2 "⟦V2⟧" ;
    HoleDet = the_Det ; HolePron = i_Pron ; HolePol = positivePol ; HoleTemp = mkTemp presentTense simultaneousAnt ;
    HoleAdv = ParadigmsSwe.mkAdv "⟦Adv⟧" ; HolePrep = in_Prep ;
}
