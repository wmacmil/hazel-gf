concrete HazelGFEng of HazelGF = open SyntaxEng, (Syn = SyntaxEng), ParadigmsEng in {
  lincat
    S = Syn.S ; Cl = Syn.Cl ; NP = Syn.NP ; VP = Syn.VP ; CN = Syn.CN ;
    N = Syn.N ; V = Syn.V ; V2 = Syn.V2 ; Det = Syn.Det ;
    Pron = Syn.Pron ; Pol = Syn.Pol ; Temp = Syn.Temp ;

  lin
    MkS t p cl = mkS t p cl ;
    PredVP np vp = mkCl np vp ;
    UseV v = mkVP v ;
    ComplV2 v np = mkVP v np ;
    DetCN det cn = mkNP det cn ;
    UseN n = mkCN n ;
    UsePron p = mkNP p ;

    Present = mkTemp presentTense simultaneousAnt ;
    Past = mkTemp pastTense simultaneousAnt ;
    Future = mkTemp futureTense simultaneousAnt ;
    Conditional = mkTemp conditionalTense simultaneousAnt ;
    PresentPerfect = mkTemp presentTense anteriorAnt ;
    PastPerfect = mkTemp pastTense anteriorAnt ;
    FuturePerfect = mkTemp futureTense anteriorAnt ;
    ConditionalPerfect = mkTemp conditionalTense anteriorAnt ;
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
}
