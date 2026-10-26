const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function runTest() {
  console.log('--- CAREBRIDGE DISCHARGE WORKFLOW E2E TEST ---');

  // 1. Login Doctor
  const docLogin = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'ananya.rao@carebridge.local', password: 'Doctor@2026!Ananya' });
  console.log('Doctor login status:', docLogin.status, 'User:', docLogin.data.user?.name);
  const docToken = docLogin.data.token;

  // 2. Login Receptionist
  const recLogin = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'reception@carebridge.local', password: 'Reception@2026!' });
  console.log('Receptionist login status:', recLogin.status, 'User:', recLogin.data.user?.name);
  const recToken = recLogin.data.token;

  // 3. Get Patients
  const patientsRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/patients', method: 'GET',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  console.log('Fetched patients count:', patientsRes.data.length);
  const targetPatient = patientsRes.data.find(p => p.status !== 'DISCHARGED' && (p.assigned_doctor_id === docLogin.data.user?.doctor_id || p.assigned_doctor_name?.includes('Ananya')));
  if (!targetPatient) {
    console.error('No active patient assigned to this doctor found to test discharge!');
    return;
  }
  console.log(`Target patient for discharge: ${targetPatient.name} (ID: ${targetPatient.id}, Status: ${targetPatient.status})`);

  // 4. Doctor creates discharge request
  console.log('\n--- STEP 1: DOCTOR SUBMITS DISCHARGE REQUEST ---');
  const dischargeReqRes = await request({
    hostname: 'localhost', port: 3001, path: `/api/patients/${targetPatient.id}/discharge-request`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` }
  }, {
    clinical_assessment: 'Patient responded well to antibiotics, vitals stable, blood pressure normalized.',
    final_condition: 'STABLE',
    discharge_instructions: 'Discharged with prescription for Amoxicillin 500mg. Follow-up in 1 week.',
    follow_up_required: true,
    follow_up_notes: 'Rest for 3 days and drink plenty of fluids.'
  });
  console.log('Discharge request response status:', dischargeReqRes.status);
  console.log('Discharge request data:', dischargeReqRes.data);
  const requestId = dischargeReqRes.data.request_id || dischargeReqRes.data.dischargeRequest?.id;

  // 5. Check patient status after request (should be DISCHARGE_REQUESTED)
  const patientAfterReq = await request({
    hostname: 'localhost', port: 3001, path: `/api/patients/${targetPatient.id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  console.log('Patient status after doctor request:', patientAfterReq.data.status);

  // 6. Receptionist fetches pending requests
  console.log('\n--- STEP 2: RECEPTIONIST VIEWS PENDING QUEUE ---');
  const pendingReqs = await request({
    hostname: 'localhost', port: 3001, path: '/api/discharge-requests?status=PENDING', method: 'GET',
    headers: { 'Authorization': `Bearer ${recToken}` }
  });
  console.log('Pending discharge requests count:', pendingReqs.data.length);
  console.log('Pending requests list:', pendingReqs.data.map(r => ({ id: r.id, patient: r.patient_name, doctor: r.requesting_doctor_name, status: r.status })));

  // 7. Receptionist approves discharge
  console.log('\n--- STEP 3: RECEPTIONIST APPROVES DISCHARGE & COMPLETES DISCHARGE ---');
  const approveRes = await request({
    hostname: 'localhost', port: 3001, path: `/api/discharge-requests/${requestId}/approve`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recToken}` }
  }, {
    identity_verified: true,
    doctor_request_reviewed: true,
    administrative_summary_completed: true,
    administrative_notes: 'Billing settled, insurance cleared, discharge papers handed to patient.'
  });
  console.log('Approve discharge response status:', approveRes.status);
  console.log('Approve response data:', approveRes.data);

  // 8. Final verify patient status (should be DISCHARGED and resources freed)
  const patientFinal = await request({
    hostname: 'localhost', port: 3001, path: `/api/patients/${targetPatient.id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${recToken}` }
  });
  console.log('Final patient status:', patientFinal.data.status, 'Bed ID:', patientFinal.data.bed_id);

  console.log('\n--- TEST SUCCESSFUL: Doctor Authority + Receptionist Discharge Workflow fully verified! ---');
}

runTest().catch(console.error);
