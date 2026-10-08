<?php
/** @var array $d livraison + deliverer{name,phone,quartier} + vendor{name} */

use Koligo\Notify;

$e = fn($s) => htmlspecialchars((string)($s ?? ''), ENT_QUOTES, 'UTF-8');
$xaf = fn($n) => number_format((int)$n, 0, ',', ' ');

$labels = [
    'EN_ATTENTE' => ["En attente d'un livreur", '#D4991A', '⏳'],
    'ACCEPTE' => ['Livreur en route vers le vendeur', '#C4611A', '🛵'],
    'EN_ROUTE' => ['En route vers vous', '#0D7A3E', '🚀'],
    'LIVRE' => ['Livré avec succès', '#0D7A3E', '✅'],
    'ANNULE' => ['Annulé', '#D8472A', '❌'],
];
[$sLabel, $sColor, $sIcon] = $labels[$d['status']] ?? [$d['status'], '#555', '📦'];
$shortRef = strtoupper(substr($d['id'], -8));
$shop = $d['shopName'] ?: ($d['vendor']['name'] ?? 'le vendeur');
$first = $d['recipientName'] ? explode(' ', $d['recipientName'])[0] : null;
$enRoute = $d['status'] === 'EN_ROUTE';
$livre = $d['status'] === 'LIVRE';
$final = $livre || $d['status'] === 'ANNULE';
$dateStr = date('d/m/Y', strtotime($d['createdAt'] . ' UTC'));
$initials = fn($n) => strtoupper(mb_substr(implode('', array_map(fn($p) => mb_substr($p, 0, 1), preg_split('/\s+/', trim((string)$n)))), 0, 2));
$dl = $d['deliverer'] ?? null;
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Suivi colis · KoliGo</title>
  <style><?= file_get_contents(__DIR__ . '/track.css') ?></style>
  <?php if (!$final): ?><meta http-equiv="refresh" content="30"><?php endif; ?>
</head>
<body>
  <div class="header"><div class="logo">Koli<span>Go</span></div></div>
  <div class="container">

    <div class="card greeting">
      <?php if ($first): ?>
        <div class="greeting-hi">Salut <?= $e($first) ?> 👋</div>
        <div class="greeting-sub">Ton colis de <strong><?= $e($shop) ?></strong> · suivi en temps réel</div>
      <?php else: ?>
        <div class="greeting-sub">Boutique : <strong><?= $e($shop) ?></strong></div>
      <?php endif; ?>
      <span class="ref-badge">Réf. <?= $shortRef ?></span>
    </div>

    <div class="status-badge" style="border-color:<?= $sColor ?>">
      <div class="status-icon"><?= $sIcon ?></div>
      <div>
        <div class="status-lbl">Statut de votre colis</div>
        <div class="status-txt" style="color:<?= $sColor ?>"><?= $e($sLabel) ?></div>
      </div>
    </div>

    <div class="card route-card">
      <div class="label">Itinéraire</div>
      <div class="route">
        <div class="route-row"><div class="dot from"></div><?= $e($d['pickupAddress']) ?></div>
        <div class="route-line" style="margin-left:4px"></div>
        <div class="route-row"><div class="dot to"></div><?= $e($d['dropoffAddress']) ?></div>
      </div>
    </div>

    <?php if ($dl && $dl['name']): ?>
    <div class="card">
      <div class="label">Votre livreur</div>
      <div class="deliverer-row">
        <div class="avatar"><?= $e($initials($dl['name'])) ?></div>
        <div><div class="dname"><?= $e($dl['name']) ?></div><div class="dsub"><?= $e($dl['quartier'] ?? '') ?></div></div>
      </div>
    </div>
    <?php endif; ?>

    <div class="card price-card">
      <div class="label">Montant de la livraison</div>
      <div class="price"><?= $xaf($d['priceXAF']) ?> <span>XAF</span></div>
    </div>

    <?php if ($enRoute): ?>
    <div class="card confirm-card">
      <div class="label">Confirmer la réception</div>
      <p class="confirm-info">Quand le livreur arrive, entre ton <strong>code de réception</strong> (reçu du vendeur) et ton numéro MoMo pour confirmer et payer le transport.</p>
      <p class="confirm-info" style="color:#C4611A;font-weight:600">À savoir : sur la demande de paiement de ton opérateur, le nom affiché sera « Kerry Pay », notre prestataire de paiement sécurisé. C'est normal : tu peux valider.</p>
      <div class="field">
        <label class="field-label">Code de réception</label>
        <input class="field-input" id="inp-code" placeholder="0000" maxlength="20" autocomplete="off" inputmode="numeric" style="letter-spacing:.08em;font-weight:700;font-size:17px">
      </div>
      <div class="field">
        <label class="field-label">Numéro MoMo (paiement transport)</label>
        <input class="field-input" id="inp-phone" placeholder="6XXXXXXXX" maxlength="9" inputmode="numeric" type="tel">
      </div>
      <button class="btn-confirm" id="btn-confirm">Confirmer · <?= $xaf($d['priceXAF']) ?> XAF</button>
      <div id="confirm-msg" class="confirm-msg"></div>
    </div>
    <?php endif; ?>

    <?php if ($livre): ?>
    <div class="card receipt-card" id="receipt">
      <div class="receipt-top"><div class="receipt-logo">Koli<span>Go</span></div><div class="receipt-badge">Reçu officiel</div></div>
      <div class="receipt-rows">
        <div class="receipt-row"><span>Référence</span><strong><?= $shortRef ?></strong></div>
        <div class="receipt-row"><span>Date</span><strong><?= $dateStr ?></strong></div>
        <div class="receipt-row"><span>De</span><strong><?= $e($d['pickupAddress']) ?></strong></div>
        <div class="receipt-row"><span>À</span><strong><?= $e($d['dropoffAddress']) ?></strong></div>
        <?php if ($d['shopName']): ?><div class="receipt-row"><span>Boutique</span><strong><?= $e($shop) ?></strong></div><?php endif; ?>
        <?php if ($dl && $dl['name']): ?><div class="receipt-row"><span>Livreur</span><strong><?= $e($dl['name']) ?></strong></div><?php endif; ?>
        <?php if ($d['recipientName']): ?><div class="receipt-row"><span>Destinataire</span><strong><?= $e($d['recipientName']) ?></strong></div><?php endif; ?>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-total"><span>Transport payé</span><strong><?= $xaf($d['priceXAF']) ?> XAF</strong></div>
      <div class="receipt-status">✅ Livré avec succès</div>
      <div class="receipt-footer">Ce reçu certifie la livraison par la plateforme KoliGo</div>
      <button class="btn-print" id="btn-print">⬇ Télécharger le reçu</button>
    </div>
    <?php endif; ?>

    <div class="refresh-note"><?= !$final ? 'Page actualisée automatiquement toutes les 30 s' : '' ?></div>

    <?php if (!$final): ?>
    <div class="card chat-card">
      <div class="label">Messages</div>
      <div class="chat-msgs" id="msgs"></div>
      <form class="chat-form" id="chat-form" onsubmit="return false">
        <input class="chat-input" id="chat-input" placeholder="Votre message…" autocomplete="off" maxlength="500">
        <button class="chat-btn" type="button" id="send-btn">↑</button>
      </form>
      <div class="chat-notice">Messages visibles par le vendeur et le livreur</div>
    </div>
    <?php endif; ?>
  </div>
  <div class="footer">Propulsé par <b>KoliGo</b> · La livraison collaborative au Cameroun</div>

  <script>
    const DID = <?= json_encode($d['id']) ?>;
    const RNAME = <?= json_encode($d['recipientName'] ?: 'Destinataire', JSON_UNESCAPED_UNICODE) ?>;
    function escH(s){const e=document.createElement('div');e.textContent=s;return e.innerHTML;}

    <?php if ($enRoute): ?>
    document.getElementById('btn-confirm').addEventListener('click', doConfirm);
    var _pollTimer = null;
    async function doConfirm(){
      const code = document.getElementById('inp-code').value.trim();
      const phone = document.getElementById('inp-phone').value.replace(/\s/g,'');
      const btn = document.getElementById('btn-confirm');
      const msg = document.getElementById('confirm-msg');
      if(!code){msg.className='confirm-msg err';msg.textContent='Entre ton code de réception.';return;}
      if(!phone){msg.className='confirm-msg err';msg.textContent='Entre ton numéro MoMo.';return;}
      btn.disabled = true;
      msg.className = 'confirm-msg'; msg.textContent = 'Lancement du paiement…';
      try{
        const r = await fetch('/api/deliveries/'+DID+'/client-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code,momoPhone:phone})});
        const data = await r.json();
        if(!r.ok){msg.className='confirm-msg err';msg.textContent=data.error||'Code invalide. Vérifie et réessaie.';btn.disabled=false;return;}
        if(data.pending){
          msg.className='confirm-msg ok';
          msg.innerHTML='📲 Approuve la demande MoMo sur ton téléphone…<br><small style="color:#555;font-weight:400">En attente de confirmation de paiement</small>';
          startPolling();
        } else {
          msg.className='confirm-msg ok'; msg.textContent='✅ Livraison confirmée !';
          setTimeout(function(){location.reload();},2000);
        }
      }catch(err){msg.className='confirm-msg err';msg.textContent='Erreur réseau. Réessaie.';btn.disabled=false;}
    }
    function startPolling(){
      var attempts = 0;
      _pollTimer = setInterval(async function(){
        attempts++;
        try{
          const r = await fetch('/track/'+DID+'/status');
          if(r.ok){const d=await r.json(); if(d.status==='LIVRE'){clearInterval(_pollTimer);location.reload();return;}}
        }catch(e){}
        if(attempts>=24){
          clearInterval(_pollTimer);
          var msg=document.getElementById('confirm-msg');
          if(msg){msg.className='confirm-msg err';msg.innerHTML='Paiement non détecté après 2 min.<br><small>Vérifie ton téléphone MoMo ou réessaie.</small>';}
        }
      },5000);
    }
    <?php endif; ?>

    <?php if (!$final): ?>
    async function loadMsgs(){
      try{
        const r = await fetch('/api/deliveries/'+DID+'/messages-public');
        if(!r.ok) return;
        const msgs = await r.json();
        const c = document.getElementById('msgs');
        if(!c) return;
        if(!msgs.length){c.innerHTML='<div style="text-align:center;color:#bbb;font-size:12px;padding:12px 0">Aucun message pour l\'instant</div>';return;}
        c.innerHTML = msgs.map(function(m){
          const role = {vendor:'vendor',deliverer:'deliverer',recipient:'recipient'}[m.senderRole]||'vendor';
          const t = new Date(m.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
          return '<div class="bubble '+role+'">'+escH(m.content)+'<small>'+escH(m.senderName)+' · '+t+'</small></div>';
        }).join('');
        c.scrollTop = c.scrollHeight;
      }catch(e){}
    }
    document.getElementById('send-btn').addEventListener('click', sendMsg);
    document.getElementById('chat-input').addEventListener('keydown', function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});
    async function sendMsg(){
      const inp = document.getElementById('chat-input');
      const btn = document.getElementById('send-btn');
      const content = inp.value.trim();
      if(!content) return;
      btn.disabled = true;
      try{
        await fetch('/api/deliveries/'+DID+'/recipient-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content,recipientName:RNAME})});
        inp.value=''; loadMsgs();
      }catch(e){}
      btn.disabled = false;
    }
    loadMsgs();
    setInterval(loadMsgs,10000);
    <?php endif; ?>

    <?php if ($livre): ?>
    var pb = document.getElementById('btn-print');
    if(pb) pb.addEventListener('click', function(){
      var html = document.getElementById('receipt').outerHTML;
      var full = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Recu KoliGo</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;padding:24px}.receipt-card{border:1.5px solid #D4991A;border-radius:14px;padding:20px;max-width:420px;margin:0 auto}.receipt-row,.receipt-total,.receipt-top{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0E8}.btn-print{display:none}</style></head><body>'+html+'</body></html>';
      var blob = new Blob([full],{type:'text/html;charset=utf-8'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'recu-koligo-<?= $shortRef ?>.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
    <?php endif; ?>
  </script>
</body>
</html>
