$ErrorActionPreference = 'Stop'
$B = 'http://localhost:3001'
$script:fail = 0

function Call {
  param([string]$Method, [string]$Path, [string]$Json, [string]$Tok)
  $h = @{}
  if ($Tok) { $h['Authorization'] = "Bearer $Tok" }
  if ($Json) { return Invoke-RestMethod -Uri ($B + $Path) -Method $Method -Body $Json -ContentType 'application/json' -Headers $h -TimeoutSec 40 }
  return Invoke-RestMethod -Uri ($B + $Path) -Method $Method -Headers $h -TimeoutSec 40
}
function Step { param([string]$Name,[bool]$Ok,[string]$Detail)
  if ($Ok) { "  [OK]   $Name $Detail" } else { "  [FAIL] $Name $Detail"; $script:fail++ } }

"=============== 1. COMPTES ==============="
$v  = Call 'POST' '/auth/signin' '{"phone":"+237699112233","pin":"1234"}' ''
$vt = $v.accessToken
Step 'Vendeur connecte' ([bool]$vt) "-> $($v.user.name) / boutique=$($v.user.shopName)"
if ($v.user.activeRole -ne 'VENDOR') {
  $back = Call 'POST' '/auth/switch-role' '{"role":"VENDOR"}' $vt
  $vt = $back.accessToken
  Step 'Remis en role vendeur' ($back.user.activeRole -eq 'VENDOR') ''
}

$dph = '+2376' + (Get-Random -Minimum 10000000 -Maximum 99999999)
$d0 = Call 'POST' '/auth/signup' ('{"name":"Herve Livreur","phone":"' + $dph + '","email":"herve@test.cm","pin":"1234","role":"DELIVERER","gender":"HOMME"}') ''
$dt = $d0.accessToken
Step 'Livreur cree' ($d0.user.activeRole -eq 'DELIVERER') "-> $($d0.user.name)"
Step 'refreshToken renvoye au signup' ([bool]$d0.refreshToken) ''

"=============== 2. CREATION COMMANDE ==============="
$body = '{"shopName":"Chez Marc","pickupAddress":"Akwa","dropoffAddress":"Bonapriso","parcelDesc":"Robe wax","weightKg":1.5,"delivererType":"EXPRESS","recipientName":"Aicha Ndongo","recipientPhone":"+237677223344","distanceKm":4,"productPriceXAF":15000}'
$d = Call 'POST' '/api/deliveries' $body $vt
$id = $d.id
Step 'Commande creee' ($d.status -eq 'EN_ATTENTE') "-> $($d.priceXAF) XAF"
Step 'Codes generes' (([bool]$d.collectCode) -and ([bool]$d.deliverCode)) "collect=$($d.collectCode) deliver=$($d.deliverCode)"
Step 'Boutique reprise du profil' ($d.shopName -eq 'Chez Marc') ''

"=============== 3. ACCEPTATION LIVREUR ==============="
$av = Call 'GET' '/api/deliveries/available' '' $dt
Step 'Course visible par le livreur' (@(@($av) | Where-Object { $_.id -eq $id }).Count -eq 1) "($(@($av).Count) dispo)"
$acc = Call 'PATCH' "/api/deliveries/$id/accept" '{}' $dt
Step 'Acceptee' ($acc.status -eq 'ACCEPTE') "-> $($acc.status)"
$col = Call 'PATCH' "/api/deliveries/$id/confirm-collect" ('{"collectCode":"' + $d.collectCode + '"}') $dt
Step 'Colis collecte' ($col.status -eq 'EN_ROUTE') "-> $($col.status)"

"=============== 4. MESSAGES A 3 ==============="
Call 'POST' "/api/deliveries/$id/messages" '{"content":"Bonjour, le colis est pret"}' $vt | Out-Null
Call 'POST' "/api/deliveries/$id/messages" '{"content":"Je suis en route, 10 min"}' $dt | Out-Null
Call 'POST' "/api/deliveries/$id/recipient-message" '{"content":"Je vous attends devant le portail","recipientName":"Aicha Ndongo"}' '' | Out-Null

$mV = Call 'GET' "/api/deliveries/$id/messages" '' $vt
$mD = Call 'GET' "/api/deliveries/$id/messages" '' $dt
$mP = Call 'GET' "/api/deliveries/$id/messages-public" '' ''
Step 'Vendeur voit les 3 messages'      (@($mV).Count -eq 3) "($(@($mV).Count))"
Step 'Livreur voit les 3 messages'      (@($mD).Count -eq 3) "($(@($mD).Count))"
Step 'Destinataire voit les 3 messages' (@($mP).Count -eq 3) "($(@($mP).Count))"
$roles = ((@($mV) | ForEach-Object { $_.senderRole }) -join ',')
Step 'Roles emetteurs corrects' ($roles -eq 'vendor,deliverer,recipient') "-> $roles"
foreach ($m in @($mV)) { "         [$($m.senderRole)] $($m.senderName) : $($m.content)" }

"=============== 5. CLOISONNEMENT ==============="
$oph = '+2376' + (Get-Random -Minimum 10000000 -Maximum 99999999)
$o = Call 'POST' '/auth/signup' ('{"name":"Intrus","phone":"' + $oph + '","email":"x@test.cm","pin":"1234","role":"DELIVERER"}') ''
$blocked = $false
try { Call 'GET' "/api/deliveries/$id/messages" '' $o.accessToken | Out-Null } catch { $blocked = $true }
Step 'Tiers non implique bloque sur le chat' $blocked ''

"=============== 6. PAIEMENT DESTINATAIRE ==============="
try { $pay = Call 'POST' '/api/deliveries/client-pay' ('{"clientToken":"' + $d.clientToken + '","deliverCode":"' + $d.deliverCode + '","momoPhone":"677223344"}') ''
      Step 'Paiement MoMo destinataire' ([bool]$pay.transactionId) "-> $($pay.amount) XAF, ref=$($pay.transactionId)" }
catch { Step 'Paiement MoMo destinataire' $false $_.ErrorDetails.Message }

"=============== 7. LIVRAISON ==============="
$del = Call 'PATCH' "/api/deliveries/$id/confirm-deliver" ('{"deliverCode":"' + $d.deliverCode + '"}') $dt
Step 'Livree' ($del.status -eq 'LIVRE') "-> $($del.status)"
$w = Call 'GET' '/api/wallet' '' $dt
Step 'Portefeuille livreur credite' ($w.balance -gt 0) "-> $($w.balance) XAF"

"=============== 8. BASCULEMENT DE ROLE ==============="
$sw1 = Call 'POST' '/auth/switch-role' '{"role":"DELIVERER"}' $vt
Step 'Vendeur -> Livreur' ($sw1.user.activeRole -eq 'DELIVERER') "role=$($sw1.user.activeRole)"
Step 'Champ accessToken present' ([bool]$sw1.accessToken) '(et non result.token)'
$okTok = $false
try { Call 'GET' '/api/deliveries/available' '' $sw1.accessToken | Out-Null; $okTok = $true } catch {}
Step 'Nouveau jeton ouvre les routes livreur' $okTok ''
$sw2 = Call 'POST' '/auth/switch-role' '{"role":"VENDOR"}' $sw1.accessToken
Step 'Livreur -> Vendeur' ($sw2.user.activeRole -eq 'VENDOR') "role=$($sw2.user.activeRole)"

"=============== 9. SUIVI PUBLIC DESTINATAIRE ==============="
try { $tr = Call 'GET' "/api/deliveries/track/$($d.clientToken)" '' ''
      Step 'Suivi public' ([bool]$tr) "statut=$($tr.status)" }
catch { Step 'Suivi public' $false $_.ErrorDetails.Message }

""
if ($script:fail -eq 0) { "RESULTAT : tous les tests passent" } else { "RESULTAT : $($script:fail) echec(s)" }
