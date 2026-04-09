#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function getEnv(name, fallback) {
  return process.env[name] ?? fallback;
}

function mustEnv(name, fallback) {
  const value = getEnv(name, fallback);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isoDateFromOffset(startDate, dayOffset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function chunks(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function listAllUsers(adminClient) {
  const users = [];
  let page = 1;

  while (true) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) {
      throw result.error;
    }

    const pageUsers = result.data.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

function makePhoto(seed, width = 1200, height = 800) {
  return {
    fullUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
    thumbnailUrl: `https://picsum.photos/seed/${seed}/420/280`,
    width,
    height
  };
}

function buildDay({ seed, highlight, journal, hashtags, location, favorite = false }) {
  return {
    highlight,
    journal,
    hashtags,
    favorite,
    locations: [location],
    photos: [makePhoto(seed)]
  };
}

function buildTrip({
  name,
  timezone,
  startDate,
  reflection,
  tripTypes,
  links,
  companionGroups,
  companionPeople,
  days
}) {
  return {
    name,
    timezone,
    startDate,
    endDate: isoDateFromOffset(startDate, days.length - 1),
    status: 'completed',
    reflection,
    tripTypes,
    links,
    companionGroups,
    companionPeople,
    days
  };
}

const DEMO_TRIPS = [
  buildTrip({
    name: 'Japan Spring Loop',
    timezone: 'Asia/Tokyo',
    startDate: '2024-03-10',
    reflection: 'Great food, easy trains, and lots of walking.',
    tripTypes: ['city', 'food', 'culture'],
    links: [{ label: 'Route', url: 'https://example.com/japan-route' }],
    companionGroups: ['College Crew'],
    companionPeople: ['Avery Chen'],
    days: [
      buildDay({
        seed: 'japan-day1',
        highlight: 'Senso-ji at sunset.',
        journal: 'Checked in, then walked around Asakusa.',
        hashtags: ['tokyo', 'temple'],
        favorite: true,
        location: {
          displayName: 'Senso-ji Temple, Tokyo, Japan',
          city: 'Tokyo',
          region: 'Tokyo',
          country: 'Japan',
          lat: 35.7148,
          lng: 139.7967
        }
      }),
      buildDay({
        seed: 'japan-day2',
        highlight: 'Shibuya crossing at night.',
        journal: 'Visited Shibuya and had sushi for dinner.',
        hashtags: ['shibuya', 'food'],
        location: {
          displayName: 'Shibuya, Tokyo, Japan',
          city: 'Tokyo',
          region: 'Tokyo',
          country: 'Japan',
          lat: 35.6595,
          lng: 139.7005
        }
      }),
      buildDay({
        seed: 'japan-day3',
        highlight: 'Kyoto shrines early morning.',
        journal: 'Took the train to Kyoto and explored old streets.',
        hashtags: ['kyoto', 'shrines'],
        location: {
          displayName: 'Fushimi Inari Taisha, Kyoto, Japan',
          city: 'Kyoto',
          region: 'Kyoto',
          country: 'Japan',
          lat: 34.9671,
          lng: 135.7727
        }
      })
    ]
  }),
  buildTrip({
    name: 'Pacific Coast Drive',
    timezone: 'America/Los_Angeles',
    startDate: '2023-08-02',
    reflection: 'Relaxed road trip with ocean views.',
    tripTypes: ['roadtrip', 'nature', 'friends'],
    links: [{ label: 'Road map', url: 'https://example.com/coast-map' }],
    companionGroups: ['Workmates'],
    companionPeople: ['Jordan Lee'],
    days: [
      buildDay({
        seed: 'coast-day1',
        highlight: 'Bridge views in fog.',
        journal: 'Started in San Francisco and drove south.',
        hashtags: ['roadtrip', 'coast'],
        location: {
          displayName: 'Golden Gate Bridge, San Francisco, CA, USA',
          city: 'San Francisco',
          region: 'California',
          country: 'United States',
          lat: 37.8199,
          lng: -122.4783
        }
      }),
      buildDay({
        seed: 'coast-day2',
        highlight: 'Big Sur pullouts and cliffs.',
        journal: 'Stopped often for photos and quick hikes.',
        hashtags: ['bigsur', 'scenic'],
        favorite: true,
        location: {
          displayName: 'Big Sur, California, USA',
          city: 'Big Sur',
          region: 'California',
          country: 'United States',
          lat: 36.2704,
          lng: -121.8081
        }
      }),
      buildDay({
        seed: 'coast-day3',
        highlight: 'Venice Beach at sunset.',
        journal: 'Finished in LA with a short beach walk.',
        hashtags: ['losangeles', 'beach'],
        location: {
          displayName: 'Venice Beach, Los Angeles, CA, USA',
          city: 'Los Angeles',
          region: 'California',
          country: 'United States',
          lat: 33.985,
          lng: -118.4695
        }
      })
    ]
  }),
  buildTrip({
    name: 'Iceland Lights',
    timezone: 'Atlantic/Reykjavik',
    startDate: '2022-11-15',
    reflection: 'Cold weather and clear skies for aurora nights.',
    tripTypes: ['nature', 'winter', 'photography'],
    links: [{ label: 'Forecast', url: 'https://example.com/aurora-forecast' }],
    companionGroups: ['Family'],
    companionPeople: ['Maya Patel'],
    days: [
      buildDay({
        seed: 'iceland-day1',
        highlight: 'Blue Lagoon reset day.',
        journal: 'Landed early and relaxed in warm water.',
        hashtags: ['iceland', 'lagoon'],
        location: {
          displayName: 'Blue Lagoon, Grindavik, Iceland',
          city: 'Grindavik',
          region: 'Southern Peninsula',
          country: 'Iceland',
          lat: 63.8804,
          lng: -22.4495
        }
      }),
      buildDay({
        seed: 'iceland-day2',
        highlight: 'Waterfalls on the south coast.',
        journal: 'Drove through wind and stopped at Skogafoss.',
        hashtags: ['waterfall', 'southcoast'],
        favorite: true,
        location: {
          displayName: 'Skogafoss, Iceland',
          city: 'Skogar',
          region: 'Southern Region',
          country: 'Iceland',
          lat: 63.5321,
          lng: -19.5114
        }
      }),
      buildDay({
        seed: 'iceland-day3',
        highlight: 'Aurora over Reykjavik outskirts.',
        journal: 'Waited after dark and saw a bright green arc.',
        hashtags: ['aurora', 'night'],
        location: {
          displayName: 'Reykjavik, Iceland',
          city: 'Reykjavik',
          region: 'Capital Region',
          country: 'Iceland',
          lat: 64.1466,
          lng: -21.9426
        }
      })
    ]
  }),
  buildTrip({
    name: 'Lisbon Remote Sprint',
    timezone: 'Europe/Lisbon',
    startDate: '2021-05-03',
    reflection: 'Simple remote-work week with good routines.',
    tripTypes: ['remotework', 'city', 'food'],
    links: [{ label: 'Cowork pass', url: 'https://example.com/lisbon-cowork' }],
    companionGroups: ['Workmates'],
    companionPeople: ['Riley Gomez'],
    days: [
      buildDay({
        seed: 'lisbon-day1',
        highlight: 'Tram 28 through old town.',
        journal: 'Set up workspace and explored Alfama in the evening.',
        hashtags: ['lisbon', 'remotework'],
        location: {
          displayName: 'Alfama, Lisbon, Portugal',
          city: 'Lisbon',
          region: 'Lisbon',
          country: 'Portugal',
          lat: 38.711,
          lng: -9.1294
        }
      }),
      buildDay({
        seed: 'lisbon-day2',
        highlight: 'Sunset viewpoint stop.',
        journal: 'Worked during the day and met friends for dinner.',
        hashtags: ['sunset', 'city'],
        favorite: true,
        location: {
          displayName: 'Miradouro da Senhora do Monte, Lisbon, Portugal',
          city: 'Lisbon',
          region: 'Lisbon',
          country: 'Portugal',
          lat: 38.7209,
          lng: -9.1318
        }
      }),
      buildDay({
        seed: 'lisbon-day3',
        highlight: 'Quick Sintra day trip.',
        journal: 'Visited Pena Palace and returned by evening.',
        hashtags: ['sintra', 'daytrip'],
        location: {
          displayName: 'Pena Palace, Sintra, Portugal',
          city: 'Sintra',
          region: 'Lisbon District',
          country: 'Portugal',
          lat: 38.7874,
          lng: -9.3904
        }
      })
    ]
  }),
  buildTrip({
    name: 'NYC Food Weekend',
    timezone: 'America/New_York',
    startDate: '2020-09-18',
    reflection: 'Short and packed with great meals.',
    tripTypes: ['weekend', 'food', 'city'],
    links: [{ label: 'Food list', url: 'https://example.com/nyc-food' }],
    companionGroups: ['College Crew'],
    companionPeople: ['Avery Chen', 'Jordan Lee'],
    days: [
      buildDay({
        seed: 'nyc-day1',
        highlight: 'Queens food crawl.',
        journal: 'Arrived in the afternoon and went to Jackson Heights.',
        hashtags: ['nyc', 'food'],
        location: {
          displayName: 'Jackson Heights, Queens, NY, USA',
          city: 'New York',
          region: 'New York',
          country: 'United States',
          lat: 40.7557,
          lng: -73.8831
        }
      }),
      buildDay({
        seed: 'nyc-day2',
        highlight: 'Bagels then Central Park.',
        journal: 'Walked the park and visited a museum.',
        hashtags: ['centralpark', 'bagels'],
        favorite: true,
        location: {
          displayName: 'Central Park, New York, NY, USA',
          city: 'New York',
          region: 'New York',
          country: 'United States',
          lat: 40.7812,
          lng: -73.9665
        }
      }),
      buildDay({
        seed: 'nyc-day3',
        highlight: 'Chinatown brunch.',
        journal: 'Ate dumplings and took the evening train home.',
        hashtags: ['chinatown', 'weekend'],
        location: {
          displayName: 'Chinatown, Manhattan, NY, USA',
          city: 'New York',
          region: 'New York',
          country: 'United States',
          lat: 40.7158,
          lng: -73.997
        }
      })
    ]
  }),
  buildTrip({
    name: 'Seoul City Week',
    timezone: 'Asia/Seoul',
    startDate: '2019-10-05',
    reflection: 'Easy subway travel and great street food.',
    tripTypes: ['city', 'culture', 'food'],
    links: [{ label: 'Metro card', url: 'https://example.com/seoul-metro' }],
    companionGroups: ['College Crew'],
    companionPeople: ['Avery Chen'],
    days: [
      buildDay({
        seed: 'seoul-day1',
        highlight: 'Gyeongbokgung palace walk.',
        journal: 'Checked in and visited the palace area.',
        hashtags: ['seoul', 'palace'],
        location: {
          displayName: 'Gyeongbokgung Palace, Seoul, South Korea',
          city: 'Seoul',
          region: 'Seoul',
          country: 'South Korea',
          lat: 37.5796,
          lng: 126.977
        }
      }),
      buildDay({
        seed: 'seoul-day2',
        highlight: 'Night market snacks.',
        journal: 'Spent the evening at Myeongdong street stalls.',
        hashtags: ['market', 'snacks'],
        favorite: true,
        location: {
          displayName: 'Myeongdong, Seoul, South Korea',
          city: 'Seoul',
          region: 'Seoul',
          country: 'South Korea',
          lat: 37.5637,
          lng: 126.983
        }
      }),
      buildDay({
        seed: 'seoul-day3',
        highlight: 'Han River sunset bike ride.',
        journal: 'Rode along the river before dinner.',
        hashtags: ['hanriver', 'sunset'],
        location: {
          displayName: 'Han River Park, Seoul, South Korea',
          city: 'Seoul',
          region: 'Seoul',
          country: 'South Korea',
          lat: 37.52,
          lng: 126.94
        }
      })
    ]
  }),
  buildTrip({
    name: 'Peru Highlands',
    timezone: 'America/Lima',
    startDate: '2018-06-11',
    reflection: 'Mountain views and early starts every day.',
    tripTypes: ['hiking', 'nature', 'adventure'],
    links: [{ label: 'Trail pass', url: 'https://example.com/peru-trail' }],
    companionGroups: ['Family'],
    companionPeople: ['Maya Patel'],
    days: [
      buildDay({
        seed: 'peru-day1',
        highlight: 'Cusco acclimation day.',
        journal: 'Walked slowly in Cusco and rested early.',
        hashtags: ['cusco', 'altitude'],
        location: {
          displayName: 'Cusco, Peru',
          city: 'Cusco',
          region: 'Cusco',
          country: 'Peru',
          lat: -13.5319,
          lng: -71.9675
        }
      }),
      buildDay({
        seed: 'peru-day2',
        highlight: 'Sacred Valley stops.',
        journal: 'Visited small villages and local markets.',
        hashtags: ['sacredvalley', 'markets'],
        favorite: true,
        location: {
          displayName: 'Urubamba, Peru',
          city: 'Urubamba',
          region: 'Cusco',
          country: 'Peru',
          lat: -13.3047,
          lng: -72.115
        }
      }),
      buildDay({
        seed: 'peru-day3',
        highlight: 'Machu Picchu morning entry.',
        journal: 'Took the first shuttle and explored the ruins.',
        hashtags: ['machupicchu', 'hike'],
        location: {
          displayName: 'Machu Picchu, Peru',
          city: 'Aguas Calientes',
          region: 'Cusco',
          country: 'Peru',
          lat: -13.1631,
          lng: -72.545
        }
      })
    ]
  }),
  buildTrip({
    name: 'Morocco Medina Escape',
    timezone: 'Africa/Casablanca',
    startDate: '2018-03-14',
    reflection: 'Colorful streets and calm desert nights.',
    tripTypes: ['culture', 'city', 'adventure'],
    links: [{ label: 'Train tickets', url: 'https://example.com/morocco-train' }],
    companionGroups: ['Workmates'],
    companionPeople: ['Riley Gomez'],
    days: [
      buildDay({
        seed: 'morocco-day1',
        highlight: 'Marrakech medina walk.',
        journal: 'Explored narrow streets and local shops.',
        hashtags: ['marrakech', 'medina'],
        location: {
          displayName: 'Medina of Marrakesh, Morocco',
          city: 'Marrakesh',
          region: 'Marrakesh-Safi',
          country: 'Morocco',
          lat: 31.6295,
          lng: -7.9811
        }
      }),
      buildDay({
        seed: 'morocco-day2',
        highlight: 'Atlas foothills drive.',
        journal: 'Did a half-day trip into nearby mountain roads.',
        hashtags: ['atlas', 'daytrip'],
        favorite: true,
        location: {
          displayName: 'Imlil, Morocco',
          city: 'Imlil',
          region: 'Marrakesh-Safi',
          country: 'Morocco',
          lat: 31.136,
          lng: -7.917
        }
      }),
      buildDay({
        seed: 'morocco-day3',
        highlight: 'Evening in Jemaa el-Fnaa.',
        journal: 'Returned for night food stalls and music.',
        hashtags: ['nightmarket', 'food'],
        location: {
          displayName: 'Jemaa el-Fnaa, Marrakesh, Morocco',
          city: 'Marrakesh',
          region: 'Marrakesh-Safi',
          country: 'Morocco',
          lat: 31.6258,
          lng: -7.9892
        }
      })
    ]
  }),
  buildTrip({
    name: 'Vancouver Rainy Weekend',
    timezone: 'America/Vancouver',
    startDate: '2017-11-03',
    reflection: 'Light rain, good coffee, and easy city walks.',
    tripTypes: ['weekend', 'city', 'nature'],
    links: [{ label: 'Transit pass', url: 'https://example.com/van-transit' }],
    companionGroups: ['College Crew'],
    companionPeople: ['Jordan Lee'],
    days: [
      buildDay({
        seed: 'van-day1',
        highlight: 'Gastown night stroll.',
        journal: 'Arrived late and walked around the old town.',
        hashtags: ['vancouver', 'gastown'],
        location: {
          displayName: 'Gastown, Vancouver, BC, Canada',
          city: 'Vancouver',
          region: 'British Columbia',
          country: 'Canada',
          lat: 49.283,
          lng: -123.106
        }
      }),
      buildDay({
        seed: 'van-day2',
        highlight: 'Stanley Park seawall loop.',
        journal: 'Rented bikes and rode the full loop.',
        hashtags: ['stanleypark', 'cycling'],
        favorite: true,
        location: {
          displayName: 'Stanley Park, Vancouver, BC, Canada',
          city: 'Vancouver',
          region: 'British Columbia',
          country: 'Canada',
          lat: 49.3043,
          lng: -123.1443
        }
      }),
      buildDay({
        seed: 'van-day3',
        highlight: 'Granville market lunch.',
        journal: 'Stopped for lunch and flew home in the evening.',
        hashtags: ['market', 'weekend'],
        location: {
          displayName: 'Granville Island, Vancouver, BC, Canada',
          city: 'Vancouver',
          region: 'British Columbia',
          country: 'Canada',
          lat: 49.2712,
          lng: -123.134
        }
      })
    ]
  }),
  buildTrip({
    name: 'Sydney Summer Start',
    timezone: 'Australia/Sydney',
    startDate: '2017-01-07',
    reflection: 'Warm weather and easy harbor days.',
    tripTypes: ['city', 'beach', 'summer'],
    links: [{ label: 'Ferry pass', url: 'https://example.com/sydney-ferry' }],
    companionGroups: ['Family'],
    companionPeople: ['Maya Patel'],
    days: [
      buildDay({
        seed: 'sydney-day1',
        highlight: 'Opera House and harbor walk.',
        journal: 'Checked in and walked the Circular Quay area.',
        hashtags: ['sydney', 'harbor'],
        location: {
          displayName: 'Sydney Opera House, Sydney, Australia',
          city: 'Sydney',
          region: 'New South Wales',
          country: 'Australia',
          lat: -33.8568,
          lng: 151.2153
        }
      }),
      buildDay({
        seed: 'sydney-day2',
        highlight: 'Bondi coastal walk.',
        journal: 'Spent the day at the beach and nearby cafes.',
        hashtags: ['bondi', 'beach'],
        favorite: true,
        location: {
          displayName: 'Bondi Beach, Sydney, Australia',
          city: 'Sydney',
          region: 'New South Wales',
          country: 'Australia',
          lat: -33.8908,
          lng: 151.2743
        }
      }),
      buildDay({
        seed: 'sydney-day3',
        highlight: 'Manly ferry views.',
        journal: 'Took the ferry and had dinner by the water.',
        hashtags: ['ferry', 'summer'],
        location: {
          displayName: 'Manly Beach, Sydney, Australia',
          city: 'Sydney',
          region: 'New South Wales',
          country: 'Australia',
          lat: -33.795,
          lng: 151.287
        }
      })
    ]
  })
];

const DEMO_PEOPLE = [
  { first_name: 'Avery', last_name: 'Chen' },
  { first_name: 'Jordan', last_name: 'Lee' },
  { first_name: 'Maya', last_name: 'Patel' },
  { first_name: 'Riley', last_name: 'Gomez' }
];

const DEMO_GROUPS = [
  { name: 'College Crew', members: ['Avery Chen', 'Jordan Lee'] },
  { name: 'Family', members: ['Maya Patel'] },
  { name: 'Workmates', members: ['Riley Gomez', 'Jordan Lee'] }
];

function fullName(person) {
  return [person.first_name, person.last_name].filter(Boolean).join(' ');
}

async function main() {
  const supabaseUrl = mustEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY');
  const demoEmail = mustEnv('DEMO_USER_EMAIL', process.env.NEXT_PUBLIC_DEMO_EMAIL);
  const demoPassword = mustEnv('DEMO_USER_PASSWORD', process.env.NEXT_PUBLIC_DEMO_PASSWORD);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const users = await listAllUsers(adminClient);
  let demoUser = users.find((user) => user.email?.toLowerCase() === demoEmail.toLowerCase());

  if (!demoUser) {
    const created = await adminClient.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true
    });

    if (created.error || !created.data.user) {
      throw created.error ?? new Error('Could not create demo user.');
    }

    demoUser = created.data.user;
  }

  const userId = demoUser.id;

  const { data: existingTrips, error: tripsLoadError } = await adminClient
    .from('trips')
    .select('id')
    .eq('user_id', userId);

  if (tripsLoadError) {
    throw tripsLoadError;
  }

  const tripIds = (existingTrips ?? []).map((row) => row.id);

  if (tripIds.length > 0) {
    for (const batch of chunks(tripIds, 100)) {
      const { error: deleteTripsError } = await adminClient.from('trips').delete().in('id', batch);
      if (deleteTripsError) {
        throw deleteTripsError;
      }
    }
  }

  const { error: clearGroupsError } = await adminClient.from('trip_groups').delete().eq('user_id', userId);
  if (clearGroupsError) {
    throw clearGroupsError;
  }

  const { error: clearPeopleError } = await adminClient.from('people').delete().eq('user_id', userId);
  if (clearPeopleError) {
    throw clearPeopleError;
  }

  const { data: peopleRows, error: peopleInsertError } = await adminClient
    .from('people')
    .insert(DEMO_PEOPLE.map((person) => ({ ...person, user_id: userId })))
    .select('id,first_name,last_name');

  if (peopleInsertError || !peopleRows) {
    throw peopleInsertError ?? new Error('Could not insert people.');
  }

  const peopleByName = new Map(peopleRows.map((person) => [fullName(person), person.id]));

  const { data: groupRows, error: groupsInsertError } = await adminClient
    .from('trip_groups')
    .insert(DEMO_GROUPS.map((group) => ({ user_id: userId, name: group.name })))
    .select('id,name');

  if (groupsInsertError || !groupRows) {
    throw groupsInsertError ?? new Error('Could not insert trip groups.');
  }

  const groupByName = new Map(groupRows.map((group) => [group.name, group.id]));

  const groupMembershipRows = [];
  for (const group of DEMO_GROUPS) {
    const groupId = groupByName.get(group.name);
    if (!groupId) {
      throw new Error(`Missing created group id for ${group.name}`);
    }
    for (const memberName of group.members) {
      const personId = peopleByName.get(memberName);
      if (!personId) {
        throw new Error(`Missing person id for ${memberName}`);
      }
      groupMembershipRows.push({ trip_group_id: groupId, person_id: personId });
    }
  }

  const { error: groupPeopleInsertError } = await adminClient
    .from('trip_group_people')
    .insert(groupMembershipRows);
  if (groupPeopleInsertError) {
    throw groupPeopleInsertError;
  }

  for (const tripDefinition of DEMO_TRIPS) {
    const primaryGroupId = groupByName.get(tripDefinition.companionGroups[0] ?? '');

    let insertedTrip = null;
    let tripInsertError = null;

    const tripPayload = {
      user_id: userId,
      name: tripDefinition.name,
      timezone: tripDefinition.timezone,
      start_date: tripDefinition.startDate,
      end_date: tripDefinition.endDate,
      status: tripDefinition.status,
      reflection: tripDefinition.reflection,
      trip_group_id: primaryGroupId ?? null,
      is_trip_content_locked: false,
      is_reflection_locked: false
    };

    ({ data: insertedTrip, error: tripInsertError } = await adminClient
      .from('trips')
      .insert(tripPayload)
      .select('id')
      .single());

    if (tripInsertError?.code === 'PGRST204' && String(tripInsertError.message).includes('timezone')) {
      const { timezone: _ignored, ...payloadWithoutTimezone } = tripPayload;
      ({ data: insertedTrip, error: tripInsertError } = await adminClient
        .from('trips')
        .insert(payloadWithoutTimezone)
        .select('id')
        .single());
    }

    if (tripInsertError || !insertedTrip) {
      throw tripInsertError ?? new Error(`Could not insert trip ${tripDefinition.name}`);
    }

    const tripId = insertedTrip.id;

    if (tripDefinition.tripTypes.length) {
      const { error: typesError } = await adminClient.from('trip_types').insert(
        tripDefinition.tripTypes.map((type) => ({ trip_id: tripId, type }))
      );
      if (typesError) {
        throw typesError;
      }
    }

    if (tripDefinition.links.length) {
      const { error: linksError } = await adminClient.from('trip_links').insert(
        tripDefinition.links.map((link) => ({
          trip_id: tripId,
          label: link.label,
          url: link.url
        }))
      );
      if (linksError) {
        throw linksError;
      }
    }

    const companionGroupRows = tripDefinition.companionGroups.map((groupName) => {
      const groupId = groupByName.get(groupName);
      if (!groupId) {
        throw new Error(`Unknown companion group ${groupName}`);
      }
      return { trip_id: tripId, trip_group_id: groupId };
    });

    if (companionGroupRows.length) {
      const { error: companionGroupsError } = await adminClient
        .from('trip_companion_groups')
        .insert(companionGroupRows);
      if (companionGroupsError) {
        throw companionGroupsError;
      }
    }

    const companionPeopleRows = tripDefinition.companionPeople.map((personName) => {
      const personId = peopleByName.get(personName);
      if (!personId) {
        throw new Error(`Unknown companion person ${personName}`);
      }
      return { trip_id: tripId, person_id: personId };
    });

    if (companionPeopleRows.length) {
      const { error: companionPeopleError } = await adminClient
        .from('trip_companion_people')
        .insert(companionPeopleRows);
      if (companionPeopleError) {
        throw companionPeopleError;
      }
    }

    for (let dayIndex = 0; dayIndex < tripDefinition.days.length; dayIndex += 1) {
      const dayDefinition = tripDefinition.days[dayIndex];
      const date = isoDateFromOffset(tripDefinition.startDate, dayIndex);

      const { data: insertedDay, error: dayInsertError } = await adminClient
        .from('trip_days')
        .insert({
          trip_id: tripId,
          day_index: dayIndex + 1,
          date,
          highlight: dayDefinition.highlight,
          journal_entry: dayDefinition.journal,
          is_favorite: Boolean(dayDefinition.favorite),
          is_locked: false
        })
        .select('id')
        .single();

      if (dayInsertError || !insertedDay) {
        throw dayInsertError ?? new Error(`Could not insert day ${dayIndex + 1} for ${tripDefinition.name}`);
      }

      const tripDayId = insertedDay.id;

      const paragraphs = dayDefinition.journal
        .split(/\n\n+/)
        .map((text) => text.trim())
        .filter(Boolean);

      if (paragraphs.length) {
        const storyIndexes = new Set(dayDefinition.storyParagraphIndexes ?? []);
        const { error: paragraphError } = await adminClient.from('trip_day_paragraphs').insert(
          paragraphs.map((text, paragraphIndex) => ({
            trip_day_id: tripDayId,
            position: paragraphIndex + 1,
            text,
            is_story: storyIndexes.has(paragraphIndex + 1)
          }))
        );
        if (paragraphError) {
          throw paragraphError;
        }
      }

      const insertedLocations = [];
      if (dayDefinition.locations.length) {
        const { data: locationRows, error: locationError } = await adminClient
          .from('trip_locations')
          .insert(
            dayDefinition.locations.map((location) => ({
              trip_day_id: tripDayId,
              display_name: location.displayName,
              city: location.city,
              region: location.region,
              country: location.country,
              lat: location.lat,
              lng: location.lng
            }))
          )
          .select('id');

        if (locationError) {
          throw locationError;
        }

        insertedLocations.push(...(locationRows ?? []));
      }

      if (dayDefinition.hashtags.length) {
        const { error: hashtagError } = await adminClient.from('trip_day_hashtags').insert(
          dayDefinition.hashtags.map((hashtag) => ({
            trip_day_id: tripDayId,
            hashtag
          }))
        );
        if (hashtagError) {
          throw hashtagError;
        }
      }

      if (dayDefinition.photos.length) {
        const primaryLocationId = insertedLocations[0]?.id ?? null;
        const { error: photoError } = await adminClient.from('photos').insert(
          dayDefinition.photos.map((photo) => ({
            trip_id: tripId,
            trip_day_id: tripDayId,
            trip_location_id: primaryLocationId,
            thumbnail_url: photo.thumbnailUrl,
            full_url: photo.fullUrl,
            width: photo.width,
            height: photo.height
          }))
        );
        if (photoError) {
          throw photoError;
        }
      }
    }
  }

  console.log('Demo data seeded successfully.');
  console.log(`User: ${demoEmail}`);
  console.log(`Trips created: ${DEMO_TRIPS.length}`);
}

main().catch((error) => {
  console.error('Failed to seed demo data.');
  console.error(error);
  process.exitCode = 1;
});
