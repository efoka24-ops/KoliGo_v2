import { Router, Request, Response } from 'express';
import { verifyAccess } from '../utils/jwt';
import { prisma } from '../models/prisma';

const router = Router();

const STATUS_LABEL: Record<string, { fr: string; color: string; icon: string }> = {
  EN_ATTENTE: { fr: "En attente d'un livreur",        color: '#D4991A', icon: '⏳' },
  ACCEPTE:    { fr: 'Livreur en route vers le vendeur', color: '#C4611A', icon: '🛵' },
  EN_ROUTE:   { fr: 'En route vers vous',               color: '#0D7A3E', icon: '🚀' },
  LIVRE:      { fr: 'Livré avec succès',                 color: '#0D7A3E', icon: '✅' },
  ANNULE:     { fr: 'Annulé',                            color: '#D8472A', icon: '❌' },
};

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function html(d: any): string {
  const s         = STATUS_LABEL[d.status] ?? { fr: d.status, color: '#555', icon: '📦' };
  const shortRef  = d.id.slice(-8).toUpperCase();
  const shopLabel = esc(d.shopName ?? d.vendor?.name ?? 'le vendeur');
  const firstName = d.recipientName ? esc(d.recipientName.split(' ')[0]) : null;
  const isEnRoute = d.status === 'EN_ROUTE';
  const isLivre   = d.status === 'LIVRE';
  const isFinal   = isLivre || d.status === 'ANNULE';
  const dateStr   = new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const greetingSection = firstName ? `
    <div class="card greeting">
      <div class="greeting-hi">Salut ${firstName} 👋</div>
      <div class="greeting-sub">Ton colis de <strong>${shopLabel}</strong> · suivi en temps réel</div>
      <span class="ref-badge">Réf. ${shortRef}</span>
    </div>` : `
    <div class="card greeting">
      <div class="greeting-sub">Boutique : <strong>${shopLabel}</strong></div>
      <span class="ref-badge">Réf. ${shortRef}</span>
    </div>`;

  const delivererSection = d.deliverer?.name ? `
    <div class="card">
      <div class="label">Votre livreur</div>
      <div class="deliverer-row">
        <div class="avatar">${esc(d.deliverer.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2))}</div>
        <div>
          <div class="dname">${esc(d.deliverer.name)}</div>
          <div class="dsub">${esc(d.deliverer.quartier ?? '')}</div>
        </div>
      </div>
    </div>` : '';

  const confirmSection = isEnRoute ? `
    <div class="card confirm-card">
      <div class="label">Confirmer la réception</div>
      <p class="confirm-info">Quand le livreur arrive, entre ton <strong>code de réception</strong> (reçu du vendeur) et ton numéro MoMo pour confirmer et payer le transport.</p>
      <div class="field">
        <label class="field-label">Code de réception</label>
        <input class="field-input" id="inp-code" placeholder="${shortRef}" maxlength="20" autocomplete="off" autocapitalize="characters" style="letter-spacing:.08em;font-weight:700;font-size:17px">
      </div>
      <div class="field">
        <label class="field-label">Numéro MoMo (paiement transport)</label>
        <input class="field-input" id="inp-phone" placeholder="6XXXXXXXX" maxlength="9" inputmode="numeric" type="tel">
      </div>
      <button class="btn-confirm" id="btn-confirm">
        Confirmer · ${(d.priceXAF ?? 0).toLocaleString('fr-FR')} XAF
      </button>
      <div id="confirm-msg" class="confirm-msg"></div>
    </div>` : '';

  const receiptSection = isLivre ? `
    <div class="card receipt-card" id="receipt">
      <div class="receipt-top">
        <div class="receipt-logo">Koli<span>Go</span></div>
        <div class="receipt-badge">Reçu officiel</div>
      </div>
      <div class="receipt-rows">
        <div class="receipt-row"><span>Référence</span><strong>${shortRef}</strong></div>
        <div class="receipt-row"><span>Date</span><strong>${dateStr}</strong></div>
        <div class="receipt-row"><span>De</span><strong>${esc(d.pickupAddress)}</strong></div>
        <div class="receipt-row"><span>À</span><strong>${esc(d.dropoffAddress)}</strong></div>
        ${d.shopName ? `<div class="receipt-row"><span>Boutique</span><strong>${shopLabel}</strong></div>` : ''}
        ${d.deliverer?.name ? `<div class="receipt-row"><span>Livreur</span><strong>${esc(d.deliverer.name)}</strong></div>` : ''}
        ${d.recipientName ? `<div class="receipt-row"><span>Destinataire</span><strong>${esc(d.recipientName)}</strong></div>` : ''}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-total">
        <span>Transport payé</span>
        <strong>${(d.priceXAF ?? 0).toLocaleString('fr-FR')} XAF</strong>
      </div>
      <div class="receipt-status">✅ Livré avec succès</div>
      <div class="receipt-footer">Ce reçu certifie la livraison par la plateforme KoliGo</div>
      <button class="btn-print" id="btn-print">⬇ Télécharger le reçu</button>
    </div>` : '';

  const contactsHtml = [
    d.deliverer?.name ? `<div class="contact"><div class="contact-av" style="background:#0D7A3E">${esc(d.deliverer.name.split(' ').map((p: string) => p[0]).join('').slice(0,2))}</div><div><div class="contact-name">${esc(d.deliverer.name)}</div><div class="contact-role">Livreur</div></div></div>` : '',
    (d.shopName || d.vendor?.name) ? `<div class="contact"><div class="contact-av" style="background:#C4611A">${esc((d.shopName ?? d.vendor?.name ?? '?').slice(0,2).toUpperCase())}</div><div><div class="contact-name">${esc(d.shopName ?? d.vendor?.name ?? '')}</div><div class="contact-role">Vendeur</div></div></div>` : '',
  ].filter(Boolean).join('');

  const chatSection = !isFinal ? `
    <div class="card chat-card">
      <div class="label">Messages</div>
      ${contactsHtml ? `<div class="contacts-row">${contactsHtml}</div>` : ''}
      <div class="chat-msgs" id="msgs"></div>
      <form class="chat-form" id="chat-form" onsubmit="return false">
        <input class="chat-input" id="chat-input" placeholder="Votre message…" autocomplete="off" maxlength="500">
        <button class="chat-btn" type="button" id="send-btn">↑</button>
      </form>
      <div class="chat-notice">Messages visibles par le vendeur et le livreur</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Suivi colis · KoliGo</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FBF5E6;min-height:100vh;padding-bottom:40px}
    .header{background:#0E2116;padding:16px 20px;display:flex;align-items:center;gap:12px}
    .logo{font-size:22px;font-weight:900;color:#D4991A;letter-spacing:-0.5px}
    .logo span{color:#fff}
    .container{max-width:480px;margin:0 auto;padding:20px 16px;display:flex;flex-direction:column;gap:14px}
    .card{background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
    .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px}
    /* Greeting */
    .greeting{border-left:4px solid #D4991A}
    .greeting-hi{font-size:20px;font-weight:800;color:#1a1a1a;margin-bottom:4px}
    .greeting-sub{font-size:14px;color:#666;line-height:1.5}
    .ref-badge{display:inline-block;background:#F0F0EA;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:#555;margin-top:10px;letter-spacing:.06em}
    /* Status */
    .status-badge{border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:14px;background:#fff;border:2px solid;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    .status-icon{font-size:36px;flex-shrink:0}
    .status-lbl{font-size:11px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .status-txt{font-size:20px;font-weight:800;margin-top:2px}
    /* Route */
    .route{display:flex;flex-direction:column;gap:8px}
    .route-row{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:#1a1a1a}
    .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .dot.from{background:#D4991A}.dot.to{background:#0D7A3E}
    .route-line{width:2px;height:16px;background:#e0e0e0;margin-left:4px}
    /* Deliverer */
    .deliverer-row{display:flex;align-items:center;gap:12px}
    .avatar{width:44px;height:44px;border-radius:14px;background:#0D7A3E;color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .dname{font-size:16px;font-weight:700;color:#1a1a1a}
    .dsub{font-size:13px;color:#888;margin-top:2px}
    /* Price */
    .price{font-size:30px;font-weight:900;color:#1a1a1a}
    .price span{font-size:14px;font-weight:500;color:#888}
    /* Confirm */
    .confirm-card{border:2px solid #0D7A3E}
    .confirm-info{font-size:13px;color:#555;line-height:1.6;margin-bottom:14px}
    .field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
    .field-label{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em}
    .field-input{border:1.5px solid #E8DCC8;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;font-family:inherit;transition:border-color .2s;width:100%}
    .field-input:focus{border-color:#0D7A3E}
    .btn-confirm{width:100%;background:#0D7A3E;color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px;transition:opacity .2s}
    .btn-confirm:disabled{opacity:.5;cursor:default}
    .confirm-msg{margin-top:10px;font-size:13px;text-align:center;font-weight:600;min-height:18px}
    .confirm-msg.ok{color:#0D7A3E}.confirm-msg.err{color:#D8472A}
    /* Receipt */
    .receipt-card{border:1.5px solid #D4991A}
    .receipt-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #F0EBE0}
    .receipt-logo{font-size:22px;font-weight:900;color:#D4991A;letter-spacing:-.5px}
    .receipt-logo span{color:#0E2116}
    .receipt-badge{background:#0D7A3E;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}
    .receipt-rows{display:flex;flex-direction:column;gap:0}
    .receipt-row{display:flex;justify-content:space-between;align-items:flex-start;font-size:13px;padding:8px 0;border-bottom:1px solid #F5F0E8}
    .receipt-row span{color:#888;flex-shrink:0;margin-right:12px}
    .receipt-row strong{color:#1a1a1a;font-weight:700;text-align:right}
    .receipt-divider{height:1px;background:#E8DCC8;margin:14px 0}
    .receipt-total{display:flex;justify-content:space-between;align-items:center;padding:4px 0}
    .receipt-total span{color:#555;font-size:14px;font-weight:600}
    .receipt-total strong{color:#0D7A3E;font-size:24px;font-weight:900}
    .receipt-status{text-align:center;font-size:14px;font-weight:700;color:#0D7A3E;margin:14px 0 4px}
    .receipt-footer{text-align:center;font-size:11px;color:#aaa;margin-bottom:14px}
    .btn-print{width:100%;background:#0E2116;color:#D4991A;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.02em}
    /* Pending payment banner */
    .pending-banner{background:#EFF8F1;border:1.5px solid #0D7A3E;border-radius:10px;padding:14px;text-align:center;font-size:13px;font-weight:600;color:#0D7A3E;margin-bottom:14px}
    .pending-dots{display:inline-flex;gap:5px;margin-bottom:8px}
    .pending-dots span{width:8px;height:8px;border-radius:50%;background:#0D7A3E;animation:pd .9s infinite alternate}
    .pending-dots span:nth-child(2){animation-delay:.3s}
    .pending-dots span:nth-child(3){animation-delay:.6s}
    @keyframes pd{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
    /* Chat */
    .chat-card{}
    .contacts-row{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap}
    .contact{display:flex;align-items:center;gap:8px}
    .contact-av{width:36px;height:36px;border-radius:10px;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .contact-name{font-size:13px;font-weight:700;color:#1a1a1a}
    .contact-role{font-size:11px;color:#888}
    .chat-msgs{display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;margin-bottom:12px}
    .bubble{padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;max-width:80%}
    .bubble.vendor{background:#EFF8F1;color:#0D7A3E;align-self:flex-start}
    .bubble.deliverer{background:#FEF0E3;color:#C4611A;align-self:flex-start}
    .bubble.recipient{background:#EEF2FF;color:#4338CA;align-self:flex-end}
    .bubble small{display:block;font-size:10px;opacity:.6;margin-top:3px}
    .chat-form{display:flex;gap:8px}
    .chat-input{flex:1;border:1.5px solid #E8DCC8;border-radius:20px;padding:9px 14px;font-size:14px;outline:none}
    .chat-btn{background:#0D7A3E;color:#fff;border:none;border-radius:20px;padding:0 16px;font-size:20px;cursor:pointer;flex-shrink:0}
    .chat-btn:disabled{background:#ccc}
    .chat-notice{font-size:11px;color:#aaa;text-align:center;margin-top:6px}
    .refresh-note{text-align:center;font-size:12px;color:#aaa}
    .footer{text-align:center;padding-top:20px;font-size:12px;color:#aaa}
    .footer b{color:#D4991A}
    /* Print: show only receipt */
    @media print {
      body{background:#fff!important;padding:0}
      .header,.greeting,.status-badge,.route-card,.deliverer-card,.price-card,.refresh-note,.confirm-card,.chat-card,.footer{display:none!important}
      .container{padding:0;gap:0}
      .receipt-card{box-shadow:none!important;border:1px solid #ccc;border-radius:8px;max-width:100%}
      .btn-print{display:none!important}
    }
  </style>
  ${!isFinal ? '<meta http-equiv="refresh" content="30">' : ''}
</head>
<body>
  <div class="header"><div class="logo">Koli<span>Go</span></div></div>
  <div class="container">

    ${greetingSection}

    <div class="status-badge" style="border-color:${s.color}">
      <div class="status-icon">${s.icon}</div>
      <div>
        <div class="status-lbl">Statut de votre colis</div>
        <div class="status-txt" style="color:${s.color}">${s.fr}</div>
      </div>
    </div>

    <div class="card route-card">
      <div class="label">Itinéraire</div>
      <div class="route">
        <div class="route-row"><div class="dot from"></div>${esc(d.pickupAddress)}</div>
        <div class="route-line" style="margin-left:4px"></div>
        <div class="route-row"><div class="dot to"></div>${esc(d.dropoffAddress)}</div>
      </div>
    </div>

    ${delivererSection}

    <div class="card price-card">
      <div class="label">Montant de la livraison</div>
      <div class="price">${(d.priceXAF ?? 0).toLocaleString('fr-FR')} <span>XAF</span></div>
    </div>

    ${confirmSection}
    ${receiptSection}

    <div class="refresh-note">${!isFinal ? 'Page actualisée automatiquement toutes les 30 s' : ''}</div>

    ${chatSection}

  </div>
  <div class="footer">Propulsé par <b>KoliGo</b> · La livraison collaborative au Cameroun</div>

  <script>
    const DID = '${esc(d.id)}';
    const RNAME = '${esc(d.recipientName ?? 'Destinataire')}';
    function escH(s){const e=document.createElement('div');e.textContent=s;return e.innerHTML;}

    ${isEnRoute ? `
    document.getElementById('btn-confirm').addEventListener('click', doConfirm);
    var _pollTimer=null;
    async function doConfirm(){
      const code=document.getElementById('inp-code').value.trim().toUpperCase();
      const phone=document.getElementById('inp-phone').value.replace(/\\s/g,'');
      const btn=document.getElementById('btn-confirm');
      const msg=document.getElementById('confirm-msg');
      if(!code){msg.className='confirm-msg err';msg.textContent='Entre ton code de réception.';return;}
      if(!phone){msg.className='confirm-msg err';msg.textContent='Entre ton numéro MoMo.';return;}
      btn.disabled=true;
      msg.className='confirm-msg';msg.textContent='Lancement du paiement…';
      try{
        const r=await fetch('/api/deliveries/'+DID+'/client-confirm',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code,momoPhone:phone})
        });
        const data=await r.json();
        if(!r.ok){msg.className='confirm-msg err';msg.textContent=data.error||'Code invalide. Vérifie et réessaie.';btn.disabled=false;return;}
        if(data.pending){
          msg.className='confirm-msg ok';
          msg.innerHTML='📲 Approuve la demande MoMo sur ton téléphone…<br><small style="color:#555;font-weight:400">En attente de confirmation de paiement</small>';
          showPendingBanner();
          startPolling();
        } else {
          msg.className='confirm-msg ok';msg.textContent='✅ Livraison confirmée !';
          setTimeout(()=>location.reload(),2000);
        }
      }catch(err){msg.className='confirm-msg err';msg.textContent='Erreur réseau. Réessaie.';btn.disabled=false;}
    }
    function showPendingBanner(){
      var card=document.querySelector('.confirm-card');
      if(!card)return;
      var banner=document.createElement('div');
      banner.className='pending-banner';
      banner.innerHTML='<div class="pending-dots"><span></span><span></span><span></span></div><div>Attente du paiement MoMo…</div><div style="font-size:11px;color:#888;margin-top:4px">La page se met à jour automatiquement dès que le paiement est détecté</div>';
      card.insertBefore(banner,card.firstChild);
    }
    function startPolling(){
      var attempts=0;
      _pollTimer=setInterval(async function(){
        attempts++;
        try{
          const r=await fetch('/track/'+DID+'/status');
          if(!r.ok)return;
          const d=await r.json();
          if(d.status==='LIVRE'){clearInterval(_pollTimer);location.reload();return;}
        }catch{}
        if(attempts>=24){
          clearInterval(_pollTimer);
          var msg=document.getElementById('confirm-msg');
          if(msg){msg.className='confirm-msg err';msg.innerHTML='Paiement non détecté après 2 min.<br><small>Vérifie ton téléphone MoMo ou réessaie.</small>';}
        }
      },5000);
    }
    ` : ''}

    ${!isFinal ? `
    async function loadMsgs(){
      try{
        const r=await fetch('/api/deliveries/'+DID+'/messages-public');
        if(!r.ok)return;
        const msgs=await r.json();
        const c=document.getElementById('msgs');
        if(!c)return;
        if(!msgs.length){c.innerHTML='<div style="text-align:center;color:#bbb;font-size:12px;padding:12px 0">Aucun message pour l\'instant</div>';return;}
        c.innerHTML=msgs.map(function(m){
          const role={vendor:'vendor',deliverer:'deliverer',recipient:'recipient'}[m.senderRole]||'vendor';
          const t=new Date(m.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
          return'<div class="bubble '+role+'">'+escH(m.content)+'<small>'+escH(m.senderName)+' · '+t+'</small></div>';
        }).join('');
        c.scrollTop=c.scrollHeight;
      }catch{}
    }
    document.getElementById('send-btn').addEventListener('click',sendMsg);
    document.getElementById('chat-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});
    async function sendMsg(){
      const inp=document.getElementById('chat-input');
      const btn=document.getElementById('send-btn');
      const content=inp.value.trim();
      if(!content)return;
      btn.disabled=true;
      try{
        await fetch('/api/deliveries/'+DID+'/recipient-message',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({content,recipientName:RNAME})
        });
        inp.value='';
        loadMsgs();
      }catch{}
      btn.disabled=false;
    }
    loadMsgs();
    setInterval(loadMsgs,10000);
    ` : ''}

    ${isLivre ? `
    var pb=document.getElementById('btn-print');
    if(pb) pb.addEventListener('click',function(){
      var html=document.getElementById('receipt').outerHTML;
      var full='<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Recu KoliGo</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#fff;padding:24px}'+
        '.receipt-card{border:1.5px solid #D4991A;border-radius:14px;padding:20px;max-width:420px;margin:0 auto}'+
        '.receipt-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #F0EBE0}'+
        '.receipt-logo{font-size:22px;font-weight:900;color:#D4991A;letter-spacing:-.5px}.receipt-logo span{color:#0E2116}'+
        '.receipt-badge{background:#0D7A3E;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px}'+
        '.receipt-row{display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid #F5F0E8}'+
        '.receipt-row span{color:#888}.receipt-row strong{color:#1a1a1a;font-weight:700}'+
        '.receipt-total{display:flex;justify-content:space-between;padding:10px 0}'+
        '.receipt-total span{color:#555;font-size:14px}.receipt-total strong{color:#0D7A3E;font-size:22px;font-weight:900}'+
        '.receipt-status{text-align:center;font-size:14px;font-weight:700;color:#0D7A3E;margin:12px 0 4px}'+
        '.receipt-footer{text-align:center;font-size:11px;color:#aaa}.receipt-divider{height:1px;background:#E8DCC8;margin:12px 0}'+
        '.btn-print{display:none}</style></head><body>'+html+'</body></html>';
      var blob=new Blob([full],{type:'text/html;charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download='recu-koligo-${shortRef}.html';
      document.body.appendChild(a);a.click();
      document.body.removeChild(a);URL.revokeObjectURL(url);
    });
    ` : ''}
  </script>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lien invalide · KoliGo</title>
  <style>
    body{font-family:-apple-system,sans-serif;background:#FBF5E6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .box{background:#fff;border-radius:20px;padding:32px 24px;max-width:360px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    h2{font-size:22px;font-weight:800;color:#D8472A;margin-bottom:12px}
    p{font-size:14px;color:#666;line-height:1.6}
  </style>
</head>
<body>
  <div class="box">
    <h2>❌ Lien invalide</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

const DELIVERY_SELECT = {
  id: true, status: true, pickupAddress: true, dropoffAddress: true,
  deliverCode: true, priceXAF: true, productPriceXAF: true,
  shopName: true, recipientName: true, recipientPhone: true,
  description: true, createdAt: true, delivererType: true,
  deliverer: { select: { name: true, phone: true, quartier: true } },
  vendor:    { select: { name: true } },
} as const;

// Public status polling endpoint — used by tracking page after MoMo payment initiation
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const d = await prisma.delivery.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!d) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ status: d.status });
  } catch { res.status(500).json({ error: 'error' }); }
});

router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  try {
    let deliveryId: string;
    if (token.includes('.')) {
      // Legacy JWT clientToken — still supported for backward compat
      const payload = verifyAccess(token) as any;
      deliveryId = payload.deliveryId;
    } else {
      // Raw delivery ID — no expiry, preferred format
      deliveryId = token;
    }
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: DELIVERY_SELECT });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html(d));
  } catch (err: any) {
    const isJwtErr  = err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError';
    const isNotFound = err?.code === 'P2025';
    const msg = isJwtErr
      ? "Ce lien de suivi est expiré. Demandez un nouveau lien à l'expéditeur."
      : isNotFound
        ? 'Cette livraison est introuvable. Vérifiez le lien.'
        : 'Impossible de charger le suivi. Réessayez dans quelques instants.';
    res.status(isNotFound ? 404 : 400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(errorHtml(msg));
  }
});

export default router;
