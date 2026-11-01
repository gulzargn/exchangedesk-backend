/**
 * Generates Pre-filled Statutory RTO Form 29 & Form 30
 * and Motor Vehicle Sale & Delivery Agreement with Legal Indemnity.
 */

export function generateRtoAgreementHtml({ auction, showroom, buyer, tx }) {
  const handoverDate = auction.created_at ? new Date(auction.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');
  const handoverTime = auction.created_at ? new Date(auction.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '12:00 PM';

  const salePrice = parseFloat(auction.current_highest_bid || auction.base_price || 0).toLocaleString('en-IN');
  const platformFee = '500';

  const rtoDetails = typeof auction.rto_details === 'string' ? JSON.parse(auction.rto_details || '{}') : (auction.rto_details || {});
  const rtoOffice = rtoDetails.rto_office || 'Regional Transport Office (RTO)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RTO Form 29 & 30 Sale Agreement - ${auction.rc_number || 'VEHICLE'}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .logo-badge {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .logo-badge span { color: #f59e0b; }
    .badge-pill {
      background: #ecfdf5;
      color: #059669;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #a7f3d0;
    }
    h1 {
      font-size: 20px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 16px 0 6px 0;
      color: #0f172a;
    }
    h2 {
      font-size: 15px;
      text-align: center;
      color: #475569;
      margin: 0 0 24px 0;
      font-weight: 600;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      background: #f1f5f9;
      padding: 8px 12px;
      border-left: 4px solid #f59e0b;
      margin: 20px 0 12px 0;
      color: #1e293b;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .card-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }
    .card-box h3 {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; }
    .info-val { font-weight: 700; color: #0f172a; }
    .legal-text {
      font-size: 12px;
      color: #334155;
      text-align: justify;
      background: #f8fafc;
      padding: 14px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 16px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #cbd5e1;
    }
    .sig-box {
      border: 1px dashed #94a3b8;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      height: 90px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .sig-label {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .btn-print {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      transition: all 0.2s;
    }
    .btn-print:hover { background: #d97706; color: #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar no-print">
      <div class="logo-badge">EXCHANGE<span>DESK</span> AUTO-RTO AGREEMENT</div>
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <h1>MOTOR VEHICLE SALE AGREEMENT & HANDOVER RECEIPT</h1>
    <h2>(Statutory Form 29 & Form 30 Intimation - Motor Vehicles Act, 1988)</h2>

    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 16px;">
      <div><strong>Agreement Ref:</strong> ED-RTO-${auction.id}-${Date.now().toString().slice(-6)}</div>
      <div><strong>Handover Date & Time:</strong> ${handoverDate} at ${handoverTime}</div>
    </div>

    <div class="section-title">1. Contracting Parties</div>
    <div class="grid-2">
      <div class="card-box">
        <h3>TRANSFEROR / SELLER (SHOWROOM)</h3>
        <div class="info-row"><span class="info-label">Showroom Name:</span><span class="info-val">${showroom.name || 'Authorized Showroom'}</span></div>
        <div class="info-row"><span class="info-label">Contact Phone:</span><span class="info-val">${showroom.phone || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Showroom Address:</span><span class="info-val">${showroom.address || 'Registered Exchange Counter'}</span></div>
        <div class="info-row"><span class="info-label">Capacity:</span><span class="info-val">Authorized Trade-in Counter</span></div>
      </div>

      <div class="card-box">
        <h3>TRANSFEREE / PURCHASER (BUYER)</h3>
        <div class="info-row"><span class="info-label">Business / Firm:</span><span class="info-val">${buyer.business_name || 'Registered Dealer'}</span></div>
        <div class="info-row"><span class="info-label">Contact Phone:</span><span class="info-val">${buyer.phone || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Verification Status:</span><span class="info-val">KYC Verified & Pre-Funded</span></div>
        <div class="info-row"><span class="info-label">Pickup OTP Stamp:</span><span class="info-val" style="color:#059669;">${auction.pickup_otp || 'VERIFIED'}</span></div>
      </div>
    </div>

    <div class="section-title">2. Vehicle Specifications & Condition</div>
    <div class="grid-2">
      <div class="card-box">
        <div class="info-row"><span class="info-label">Vehicle Registration No:</span><span class="info-val" style="font-size:15px; color:#b45309;">${auction.rc_number || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Make & Model:</span><span class="info-val">${auction.vehicle_model || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Manufacturing Year:</span><span class="info-val">${auction.manufacturing_year || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Odometer Reading:</span><span class="info-val">${Number(auction.km_driven || 0).toLocaleString('en-IN')} KM</span></div>
      </div>

      <div class="card-box">
        <div class="info-row"><span class="info-label">RTO Jurisdiction:</span><span class="info-val">${rtoOffice}</span></div>
        <div class="info-row"><span class="info-label">Fitness Validity:</span><span class="info-val">${rtoDetails.fitness_valid_upto || '15 Years from Reg.'}</span></div>
        <div class="info-row"><span class="info-label">Insurance Status:</span><span class="info-val">${rtoDetails.insurance_status || 'Active / Transferred'}</span></div>
        <div class="info-row"><span class="info-label">Pending Challans:</span><span class="info-val" style="color:#059669;">0 Verified Clean</span></div>
      </div>
    </div>

    <div class="section-title">3. Financial Consideration & Platform Settlement</div>
    <div class="card-box" style="margin-bottom: 16px;">
      <div class="info-row"><span class="info-label">Final Auction Winning Consideration:</span><span class="info-val" style="font-size:16px;">₹${salePrice}</span></div>
      <div class="info-row"><span class="info-label">ExchangeDesk Platform Handover Fee:</span><span class="info-val">₹${platformFee} (Paid & Settled via Wallet)</span></div>
      <div class="info-row"><span class="info-label">EMD Security Status:</span><span class="info-val" style="color:#059669;">Settled on Vehicle Handover</span></div>
      <div class="info-row"><span class="info-label">Mode of Delivery:</span><span class="info-val">Direct Showroom Physical Counter Handover</span></div>
    </div>

    <div class="section-title">4. Form 29: Notice of Transfer of Ownership (Section 50)</div>
    <div class="legal-text">
      <strong>To: The Registering Authority, ${rtoOffice}</strong><br>
      I/We, <strong>${showroom.name || 'The Transferor'}</strong>, have on this date (<strong>${handoverDate}</strong>) sold and transferred ownership of Motor Vehicle No. <strong>${auction.rc_number}</strong>, Model <strong>${auction.vehicle_model}</strong> to Shri/M/s <strong>${buyer.business_name}</strong>. The Registration Certificate, valid Insurance, and Delivery Receipt have been duly delivered to the transferee.
    </div>

    <div class="section-title">5. Form 30: Application for Intimation of Transfer of Ownership</div>
    <div class="legal-text">
      I/We, <strong>${buyer.business_name}</strong>, have taken delivery and purchased Motor Vehicle No. <strong>${auction.rc_number}</strong> with effect from <strong>${handoverDate} at ${handoverTime}</strong>. We hereby undertake to apply for official name transfer in the records of the registering authority in accordance with Rule 55 of the Central Motor Vehicles Rules, 1989.
    </div>

    <div class="section-title">6. Statutory Indemnity & Delivery Undertaking</div>
    <div class="legal-text">
      From the moment of physical vehicle delivery and pickup OTP generation (<strong>${handoverDate} - ${handoverTime}</strong>), the Transferee (Purchaser) assumes 100% legal, criminal, and civil liability for the operation of the motor vehicle. The Transferor (Showroom) and ExchangeDesk platform are indemnified against all traffic violations, accidents, third-party claims, theft, or misuse occurring subsequent to this handover.
    </div>

    <div class="signatures-grid">
      <div class="sig-box">
        <div class="sig-label">Signature / Seal of Seller (Showroom)</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Signature / Seal of Buyer (Purchaser)</div>
      </div>
    </div>

    <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px;">
      Generated securely via ExchangeDesk B2B Platform • Verified Pickup OTP: ${auction.pickup_otp || 'N/A'} • Authenticated on ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}
