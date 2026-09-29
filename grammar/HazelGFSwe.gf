concrete HazelGFSwe of HazelGF = open SyntaxSwe, (Syn = SyntaxSwe), ParadigmsSwe in {
  lincat
    S = Syn.S ; Cl = Syn.Cl ; NP = Syn.NP ; VP = Syn.VP ; CN = Syn.CN ;
    N = Syn.N ; V = Syn.V ; V2 = Syn.V2 ; Det = Syn.Det ;
    Pron = Syn.Pron ; Pol = Syn.Pol ;

  lin
    MkS p cl = mkS p cl ; PredVP np vp = mkCl np vp ;
    UseV v = mkVP v ; ComplV2 v np = mkVP v np ;
    DetCN det cn = mkNP det cn ; UseN n = mkCN n ; UsePron p = mkNP p ;

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
    SleepV = mkV "sover" ; WalkV = mkV "går" ;
    RunV = mkV "springa" "sprang" "sprungit" ;
    SeeV2 = mkV2 (mkV "se" "såg" "sett") ;
    LoveV2 = mkV2 "älskar" ; ReadV2 = mkV2 (mkV "läsa" "läste") ;

    HoleS = mkS (mkCl (mkNP (mkPN "⟦S⟧")) (mkVP (mkV "väntar"))) ;
    HoleCl = mkCl (mkNP (mkPN "⟦Cl⟧")) (mkVP (mkV "väntar")) ;
    HoleNP = mkNP (mkPN "⟦NP⟧") ; HoleVP = mkVP (mkV "⟦VP⟧") ;
    HoleCN = mkCN (mkN "⟦CN⟧") ; HoleN = mkN "⟦N⟧" ;
    HoleV = mkV "⟦V⟧" ; HoleV2 = mkV2 "⟦V2⟧" ;
    HoleDet = the_Det ; HolePron = i_Pron ; HolePol = positivePol ;
}
