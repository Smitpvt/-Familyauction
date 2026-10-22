require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Admin = require('./models/Admin');
const Team = require('./models/Team');
const Round = require('./models/Round');
const Player = require('./models/Player');
const AuctionState = require('./models/AuctionState');
const Transaction = require('./models/Transaction');
const Bid = require('./models/Bid');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hfpl_auction';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('Clearing existing auction data...');
    await Admin.deleteMany({});
    await Team.deleteMany({});
    await Round.deleteMany({});
    await Player.deleteMany({});
    await AuctionState.deleteMany({});
    await Transaction.deleteMany({});
    await Bid.deleteMany({});

    // 1. Create Admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASS || 'hfpl2027', salt);

    const admin = new Admin({
      username: (process.env.ADMIN_DEFAULT_USER || 'admin').toLowerCase(),
      password: hashedPassword,
      name: 'HFPL Auction Master',
      role: 'admin'
    });
    await admin.save();
    console.log(`[Admin Created]: username: ${admin.username} / password: ${process.env.ADMIN_DEFAULT_PASS || 'hfpl2027'}`);

    // 2. Create 4 Premier Family Teams
    const teamsData = [
      {
        name: 'Kotawade Knight Riders',
        code: 'KKR',
        captain: 'Vijay Bhosale',
        color: '#4c1d95',
        secondaryColor: '#f59e0b',
        startingPurse: 10000,
        totalSpent: 0,
        remainingPurse: 10000,
        logo: 'KKR-Photoroom.png'
      },
      {
        name: 'Ratnagiri Royals',
        code: 'RR',
        captain: 'Sagar Chavan',
        color: '#2563eb',
        secondaryColor: '#db2777',
        startingPurse: 10000,
        totalSpent: 0,
        remainingPurse: 10000,
        logo: 'RR-Photoroom.png'
      },
      {
        name: 'Malgund Maha Giants',
        code: 'MMG',
        captain: 'Rajesh Pawar',
        color: '#ea580c',
        secondaryColor: '#0284c7',
        startingPurse: 10000,
        totalSpent: 0,
        remainingPurse: 10000,
        logo: 'MMG-Photoroom.png'
      },
      {
        name: 'Sherle Sunrisers',
        code: 'SS',
        captain: 'Shrirang Sherlekar',
        color: '#f97316',
        secondaryColor: '#1e3a8a',
        startingPurse: 10000,
        totalSpent: 0,
        remainingPurse: 10000,
        logo: 'SS-Photoroom.png'
      }
    ];

    const teams = await Team.insertMany(teamsData);
    console.log(`[Teams Created]: ${teams.length} teams`);

    // 3. Create Auction Sets / Rounds
    const roundsData = [
      {
        name: 'Set 1 — 8 Players',
        order: 1,
        description: 'Set 1 featuring 8 premier male and female cricket players.',
        status: 'active'
      },
      {
        name: 'Set 2 — 8 Players',
        order: 2,
        description: 'Set 2 featuring 8 dynamic power hitters, bowlers, and all-rounders.',
        status: 'upcoming'
      },
      {
        name: 'Set 3 — 8 Players',
        order: 3,
        description: 'Set 3 featuring 8 clutch specialists, wicketkeepers, and finishers.',
        status: 'upcoming'
      }
    ];

    const rounds = await Round.insertMany(roundsData);
    console.log(`[Sets Created]: ${rounds.length} sets`);

    // 4. Players (Set 1 has exactly 8 players with both male and female players)
    const playersData = [
      // === SET 1 (8 PLAYERS: Male & Female) ===
      {
        name: 'Rohan Sharma',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium Fast',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        description: 'Reliable all-rounder with explosive shots and dependable middle overs seam.',
        stats: { matches: 28, runs: 740, wickets: 24, highestScore: 88, strikeRate: 154.2 },
        roundId: rounds[0]._id,
        orderInRound: 1,
        status: 'upcoming'
      },
      {
        name: 'Ananya Verma',
        category: 'Batter',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Off Break',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80',
        description: 'Top-order power striker known for sublime timing and swift running between wickets.',
        stats: { matches: 26, runs: 680, wickets: 6, highestScore: 78, strikeRate: 142.5 },
        roundId: rounds[0]._id,
        orderInRound: 2,
        status: 'upcoming'
      },
      {
        name: 'Kabir Patel',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Fast',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
        description: 'Pace spearhead delivering toe-crushing yorkers in the death overs.',
        stats: { matches: 24, runs: 110, wickets: 32, highestScore: 24, strikeRate: 110.0 },
        roundId: rounds[0]._id,
        orderInRound: 3,
        status: 'upcoming'
      },
      {
        name: 'Priya Nair',
        category: 'All-rounder',
        battingStyle: 'Left Hand Bat',
        bowlingStyle: 'Left Arm Orthodox',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
        description: 'Clutch all-rounder capable of turning any high-pressure match.',
        stats: { matches: 30, runs: 590, wickets: 28, highestScore: 71, strikeRate: 138.6 },
        roundId: rounds[0]._id,
        orderInRound: 4,
        status: 'upcoming'
      },
      {
        name: 'Aarav Gupta',
        category: 'Wicketkeeper',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
        description: 'Sharp wicketkeeper with lightning quick glove work and solid middle-order batting.',
        stats: { matches: 22, runs: 520, wickets: 0, highestScore: 65, strikeRate: 135.0 },
        roundId: rounds[0]._id,
        orderInRound: 5,
        status: 'upcoming'
      },
      {
        name: 'Sneha Joshi',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Leg Spin',
        basePrice: 200,
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        description: 'Mystery wrist spinner with deceptive flight and sharp leg breaks.',
        stats: { matches: 20, runs: 75, wickets: 26, highestScore: 19, strikeRate: 98.0 },
        roundId: rounds[0]._id,
        orderInRound: 6,
        status: 'upcoming'
      },
      {
        name: 'Devansh Rao',
        category: 'Batter',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&auto=format&fit=crop&q=80',
        description: 'Classical stroke-maker with high average and exceptional boundary percentage.',
        stats: { matches: 25, runs: 710, wickets: 5, highestScore: 82, strikeRate: 145.2 },
        roundId: rounds[0]._id,
        orderInRound: 7,
        status: 'upcoming'
      },
      {
        name: 'Riya Kulkarni',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium Fast',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        description: 'Dynamic fielder and game-changing death overs power hitter.',
        stats: { matches: 27, runs: 640, wickets: 22, highestScore: 74, strikeRate: 151.0 },
        roundId: rounds[0]._id,
        orderInRound: 8,
        status: 'upcoming'
      },

      // === SET 2 (8 PLAYERS: Male & Female) ===
      {
        name: 'Arjun Singh',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Fast Express',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&auto=format&fit=crop&q=80',
        description: 'Express fast bowler delivering heavy bouncers and pinpoint deliveries.',
        stats: { matches: 26, runs: 110, wickets: 38, highestScore: 26, strikeRate: 115.0 },
        roundId: rounds[1]._id,
        orderInRound: 1,
        status: 'upcoming'
      },
      {
        name: 'Pooja Sharma',
        category: 'Batter',
        battingStyle: 'Left Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
        description: 'Elegant southpaw opening batter with crisp cover drives and steady technique.',
        stats: { matches: 21, runs: 580, wickets: 0, highestScore: 70, strikeRate: 133.0 },
        roundId: rounds[1]._id,
        orderInRound: 2,
        status: 'upcoming'
      },
      {
        name: 'Nikhil Iyer',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Leg Spin / Googly',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&fit=crop&q=80',
        description: 'Clever wrist spinner with an unreadable wrong-un.',
        stats: { matches: 25, runs: 85, wickets: 32, highestScore: 21, strikeRate: 105.0 },
        roundId: rounds[1]._id,
        orderInRound: 3,
        status: 'upcoming'
      },
      {
        name: 'Tanvi Deshmukh',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Off Break',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=80',
        description: 'Reliable anchor batter who bowls crucial middle-overs spin.',
        stats: { matches: 23, runs: 490, wickets: 19, highestScore: 58, strikeRate: 129.0 },
        roundId: rounds[1]._id,
        orderInRound: 4,
        status: 'upcoming'
      },
      {
        name: 'Sameer Rao',
        category: 'Bowler',
        battingStyle: 'Left Hand Bat',
        bowlingStyle: 'Left Arm Fast Swing',
        basePrice: 200,
        photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&fit=crop&q=80',
        description: 'Swings the new ball both ways, regular powerplay wicket taker.',
        stats: { matches: 19, runs: 65, wickets: 22, highestScore: 19, strikeRate: 98.0 },
        roundId: rounds[1]._id,
        orderInRound: 5,
        status: 'upcoming'
      },
      {
        name: 'Meera Kapoor',
        category: 'Wicketkeeper',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
        description: 'Agile keeper with rapid stumpings and calm temperament under pressure.',
        stats: { matches: 18, runs: 410, wickets: 0, highestScore: 55, strikeRate: 131.0 },
        roundId: rounds[1]._id,
        orderInRound: 6,
        status: 'upcoming'
      },
      {
        name: 'Yash Kulkarni',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Off Spin',
        basePrice: 200,
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&auto=format&fit=crop&q=80',
        description: 'Economical bowler who restricts boundary scoring under high pressure.',
        stats: { matches: 18, runs: 90, wickets: 19, highestScore: 22, strikeRate: 110.0 },
        roundId: rounds[1]._id,
        orderInRound: 7,
        status: 'upcoming'
      },
      {
        name: 'Divya Menon',
        category: 'Batter',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        description: 'Aggressive strokeplayer adept at capitalizing on loose balls.',
        stats: { matches: 22, runs: 530, wickets: 0, highestScore: 66, strikeRate: 139.0 },
        roundId: rounds[1]._id,
        orderInRound: 8,
        status: 'upcoming'
      },

      // === SET 3 (8 PLAYERS: Male & Female) ===
      {
        name: 'Karan Mehra',
        category: 'Wicketkeeper',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'None',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
        description: 'Experienced keeper-batter who controls match tempo in the late overs.',
        stats: { matches: 27, runs: 590, wickets: 0, highestScore: 68, strikeRate: 148.0 },
        roundId: rounds[2]._id,
        orderInRound: 1,
        status: 'upcoming'
      },
      {
        name: 'Shreya Das',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium',
        basePrice: 200,
        photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
        description: 'Accurate medium pacer who builds intense pressure in middle overs.',
        stats: { matches: 17, runs: 50, wickets: 20, highestScore: 16, strikeRate: 95.0 },
        roundId: rounds[2]._id,
        orderInRound: 2,
        status: 'upcoming'
      },
      {
        name: 'Manish Bhatia',
        category: 'Batter',
        battingStyle: 'Left Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        description: 'Hard-hitting batsman who takes early risks in powerplay.',
        stats: { matches: 20, runs: 440, wickets: 0, highestScore: 62, strikeRate: 139.5 },
        roundId: rounds[2]._id,
        orderInRound: 3,
        status: 'upcoming'
      },
      {
        name: 'Neha Sengupta',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
        description: 'Tactical all-rounder providing middle-order resilience and economical spells.',
        stats: { matches: 19, runs: 390, wickets: 16, highestScore: 52, strikeRate: 126.0 },
        roundId: rounds[2]._id,
        orderInRound: 4,
        status: 'upcoming'
      },
      {
        name: 'Siddharth Nair',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium',
        basePrice: 300,
        photo: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=600&auto=format&fit=crop&q=80',
        description: 'Hard-hitting lower order batter and clutch fielding specialist.',
        stats: { matches: 21, runs: 380, wickets: 17, highestScore: 49, strikeRate: 152.0 },
        roundId: rounds[2]._id,
        orderInRound: 5,
        status: 'upcoming'
      },
      {
        name: 'Kriti Sen',
        category: 'Batter',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'None',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80',
        description: 'Fearless boundary hitter with great situational awareness.',
        stats: { matches: 16, runs: 340, wickets: 0, highestScore: 59, strikeRate: 137.0 },
        roundId: rounds[2]._id,
        orderInRound: 6,
        status: 'upcoming'
      },
      {
        name: 'Varun Joshi',
        category: 'Bowler',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Off Spin',
        basePrice: 200,
        photo: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=600&auto=format&fit=crop&q=80',
        description: 'Sharp off spinner with deceptive variations and tight line.',
        stats: { matches: 15, runs: 45, wickets: 18, highestScore: 14, strikeRate: 92.0 },
        roundId: rounds[2]._id,
        orderInRound: 7,
        status: 'upcoming'
      },
      {
        name: 'Anika Roy',
        category: 'All-rounder',
        battingStyle: 'Right Hand Bat',
        bowlingStyle: 'Right Arm Medium',
        basePrice: 250,
        photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=80',
        description: 'Dynamic fielder, solid middle-order stabilizer, and dependable change bowler.',
        stats: { matches: 18, runs: 360, wickets: 15, highestScore: 48, strikeRate: 130.0 },
        roundId: rounds[2]._id,
        orderInRound: 8,
        status: 'upcoming'
      }
    ];

    const players = await Player.insertMany(playersData);
    console.log(`[Players Created]: ${players.length} players across 3 sets`);

    // 5. Initialize Live Auction State
    const firstPlayer = players[0];
    const initialAuctionState = new AuctionState({
      currentRound: rounds[0]._id,
      currentPlayer: firstPlayer._id,
      currentBid: firstPlayer.basePrice,
      highestBidder: null,
      status: 'ready',
      bidIncrementOptions: [100, 200, 500, 1000],
      selectedIncrement: 100,
      announcement: 'Welcome to HFPL Player Auction 2027! Set 1 is ready.'
    });
    await initialAuctionState.save();
    console.log(`[AuctionState Initialized]: Current player set to ${firstPlayer.name} (Base Price ₹${firstPlayer.basePrice})`);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
