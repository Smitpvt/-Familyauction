const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, raw: text };
  }
}

async function runTestFlow() {
  console.log('====================================================');
  console.log('   STARTING HFPL AUCTION END-TO-END FLOW TEST');
  console.log('====================================================\n');

  // Step 1: Admin Login
  console.log('[Step 1] Logging in as Admin...');
  const loginRes = await request('/auth/login', 'POST', { username: 'admin', password: 'hfpl2027' });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
  }
  const token = loginRes.data.token;
  console.log('✓ Admin login successful. Token acquired.\n');

  // Step 2: Create a Test Team
  console.log('[Step 2] Creating a new Team "Gujarat Gladiators"...');
  const createTeamRes = await request('/teams', 'POST', {
    name: 'Gujarat Gladiators',
    code: 'GG',
    captain: 'Hardik P',
    color: '#8b5cf6',
    startingPurse: 10000
  }, token);
  if (createTeamRes.status !== 201) throw new Error(`Create team failed: ${JSON.stringify(createTeamRes)}`);
  const newTeam = createTeamRes.data.team;
  console.log(`✓ Team created: ${newTeam.name} (${newTeam.code}) with ₹${newTeam.startingPurse} purse.\n`);

  // Step 3: Create a Test Round
  console.log('[Step 3] Creating a new Auction Round...');
  const createRoundRes = await request('/rounds', 'POST', {
    name: 'Test Championship Round',
    description: 'Round for automated verification',
    order: 99
  }, token);
  if (createRoundRes.status !== 201) throw new Error(`Create round failed: ${JSON.stringify(createRoundRes)}`);
  const newRound = createRoundRes.data.round;
  console.log(`✓ Round created: ${newRound.name} (Order ${newRound.order}).\n`);

  // Step 4: Create Players and Assign to Round
  console.log('[Step 4] Creating Test Players and assigning to round...');
  const p1Res = await request('/players', 'POST', {
    name: 'Test All-Rounder Star',
    category: 'All-rounder',
    basePrice: 500,
    roundId: newRound._id,
    orderInRound: 1
  }, token);
  const p1 = p1Res.data.player;

  const p2Res = await request('/players', 'POST', {
    name: 'Test Fast Bowler Ace',
    category: 'Bowler',
    basePrice: 300,
    roundId: newRound._id,
    orderInRound: 2
  }, token);
  const p2 = p2Res.data.player;
  console.log(`✓ Created Player 1: ${p1.name} (Base ₹${p1.basePrice})`);
  console.log(`✓ Created Player 2: ${p2.name} (Base ₹${p2.basePrice})\n`);

  // Step 5: Set Round and Start Auction on Player 1
  console.log('[Step 5] Setting active player to Player 1 and starting bidding...');
  await request('/auction/set-player', 'POST', { playerId: p1._id }, token);
  const startRes = await request('/auction/start-bidding', 'POST', {}, token);
  if (startRes.status !== 200) throw new Error(`Start bidding failed: ${JSON.stringify(startRes)}`);
  console.log('✓ Bidding started for Player 1.\n');

  // Step 6: Test Valid and Invalid Bids
  console.log('[Step 6] Testing Bid Logic & Server-side Validations...');
  // Place initial bid of ₹600 from newTeam
  const bid1 = await request('/auction/bid', 'POST', { teamId: newTeam._id, amount: 600 }, token);
  if (bid1.status !== 200) throw new Error(`Valid bid failed: ${JSON.stringify(bid1)}`);
  console.log(`✓ Accepted valid bid ₹600 from ${newTeam.name}.`);

  // Invalid Bid 1: Same team bidding against itself
  const invalidBidSelf = await request('/auction/bid', 'POST', { teamId: newTeam._id, amount: 700 }, token);
  if (invalidBidSelf.status === 400) {
    console.log(`✓ Correctly REJECTED duplicate bid from same team: "${invalidBidSelf.data.message}"`);
  } else {
    throw new Error('Failed to reject duplicate bid from same team!');
  }

  // Get another team (e.g. Super Strikers)
  const teamsListRes = await request('/teams');
  const otherTeam = teamsListRes.data.teams.find(t => t._id !== newTeam._id);

  // Invalid Bid 2: Bid exceeding purse
  const invalidBidExceedPurse = await request('/auction/bid', 'POST', { teamId: otherTeam._id, amount: 9999999 }, token);
  if (invalidBidExceedPurse.status === 400) {
    console.log(`✓ Correctly REJECTED bid exceeding available purse: "${invalidBidExceedPurse.data.message}"`);
  } else {
    throw new Error('Failed to reject bid exceeding remaining purse!');
  }

  // Invalid Bid 3: Bid lower than current bid
  const invalidBidLower = await request('/auction/bid', 'POST', { teamId: otherTeam._id, amount: 500 }, token);
  if (invalidBidLower.status === 400) {
    console.log(`✓ Correctly REJECTED bid lower than current bid: "${invalidBidLower.data.message}"`);
  } else {
    throw new Error('Failed to reject lower bid!');
  }

  // Valid Raise from other team: ₹800
  const bid2 = await request('/auction/bid', 'POST', { teamId: otherTeam._id, amount: 800 }, token);
  if (bid2.status !== 200) throw new Error(`Valid raise failed: ${JSON.stringify(bid2)}`);
  console.log(`✓ Accepted valid counter-bid ₹800 from ${otherTeam.name}.\n`);

  // Step 7: Sell Player 1 to otherTeam for ₹800
  console.log(`[Step 7] Selling Player 1 to ${otherTeam.name} for ₹800...`);
  const initialOtherPurse = otherTeam.remainingPurse;
  const sellRes = await request('/auction/sell', 'POST', {}, token);
  if (sellRes.status !== 200) throw new Error(`Sell player failed: ${JSON.stringify(sellRes)}`);
  console.log('✓ Player marked SOLD.');

  // Verify Purse Deduction
  const updatedTeamsRes = await request('/teams');
  const updatedOtherTeam = updatedTeamsRes.data.teams.find(t => t._id === otherTeam._id);
  const expectedPurse = initialOtherPurse - 800;
  if (updatedOtherTeam.remainingPurse === expectedPurse) {
    console.log(`✓ Verified Purse Deduction: ${otherTeam.name} purse correctly reduced from ₹${initialOtherPurse} to ₹${updatedOtherTeam.remainingPurse}.\n`);
  } else {
    throw new Error(`Purse deduction mismatch! Expected ${expectedPurse}, got ${updatedOtherTeam.remainingPurse}`);
  }

  // Step 8: Move to Next Player (Player 2)
  console.log('[Step 8] Moving to next player...');
  await request('/auction/set-player', 'POST', { playerId: p2._id }, token);
  console.log(`✓ Active player set to: ${p2.name}.\n`);

  // Step 9: Mark Player 2 as UNSOLD
  console.log('[Step 9] Marking Player 2 as UNSOLD...');
  const unsoldRes = await request('/auction/unsold', 'POST', {}, token);
  if (unsoldRes.status !== 200) throw new Error(`Mark unsold failed: ${JSON.stringify(unsoldRes)}`);
  console.log('✓ Player 2 marked UNSOLD.');

  // Verify NO purse was deducted
  const teamsCheckUnsold = await request('/teams');
  const checkedTeam = teamsCheckUnsold.data.teams.find(t => t._id === otherTeam._id);
  if (checkedTeam.remainingPurse === expectedPurse) {
    console.log(`✓ Verified: NO purse was deducted for UNSOLD player (remains ₹${checkedTeam.remainingPurse}).\n`);
  } else {
    throw new Error('Purse incorrectly changed after unsold mark!');
  }

  // Step 10: State Persistence Check (Simulating Projector Refresh)
  console.log('[Step 10] Simulating Projector refresh / State Persistence Check...');
  const stateCheck = await request('/auction/state');
  if (stateCheck.status === 200 && stateCheck.data.state.currentPlayer._id === p2._id && stateCheck.data.state.status === 'unsold') {
    console.log('✓ Verified: State persisted perfectly. Projector restores exact state upon reload.\n');
  } else {
    throw new Error('State persistence failed!');
  }

  // Step 11: Undo Sale of Player 1
  console.log(`[Step 11] Testing Undo / Revert Sale for Player 1 (${p1.name})...`);
  const undoRes = await request('/auction/undo-sale', 'POST', { playerId: p1._id }, token);
  if (undoRes.status !== 200) throw new Error(`Undo sale failed: ${JSON.stringify(undoRes)}`);
  console.log('✓ Revert transaction executed.');

  // Verify Purse Restoration
  const teamsCheckUndo = await request('/teams');
  const restoredTeam = teamsCheckUndo.data.teams.find(t => t._id === otherTeam._id);
  if (restoredTeam.remainingPurse === initialOtherPurse) {
    console.log(`✓ Verified Purse Restoration: ${otherTeam.name} purse fully restored back to ₹${restoredTeam.remainingPurse}!\n`);
  } else {
    throw new Error(`Purse restoration mismatch! Expected ${initialOtherPurse}, got ${restoredTeam.remainingPurse}`);
  }

  // Step 12: Check Tournament Results & CSV Export
  console.log('[Step 12] Fetching Tournament Results Summary and CSV...');
  const resultsRes = await request('/results/summary');
  if (resultsRes.status === 200 && resultsRes.data.success) {
    console.log(`✓ Results summary retrieved: ${resultsRes.data.summary.totalPlayersCount} total players, ${resultsRes.data.summary.teamSquads.length} team squads.`);
  }

  const csvRes = await fetch(`${BASE_URL}/results/export-csv`);
  if (csvRes.status === 200) {
    const csvContent = await csvRes.text();
    console.log(`✓ CSV Export downloaded successfully (${csvContent.split('\n').length} rows).\n`);
  }

  // Cleanup test artifacts
  console.log('[Cleanup] Cleaning up temporary test team, round, and players...');
  await request(`/players/${p1._id}`, 'DELETE', null, token);
  await request(`/players/${p2._id}`, 'DELETE', null, token);
  await request(`/rounds/${newRound._id}`, 'DELETE', null, token);
  await request(`/teams/${newTeam._id}`, 'DELETE', null, token);
  console.log('✓ Cleanup complete.\n');

  console.log('====================================================');
  console.log('  ALL TEST FLOW STEPS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================');
}

runTestFlow().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
