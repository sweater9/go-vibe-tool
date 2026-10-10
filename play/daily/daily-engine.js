/**
 * IntelliTools V5 — Daily Knowledge Challenge Core Engine
 * Deterministic question selection, scoring, streak management, and share card formatting.
 * Headless, dependency-free, and fully testable in Node.
 */

export const QUESTION_CATEGORIES = [
  'Science & Nature',
  'Technology & Computing',
  'Geography & World',
  'Logical Reasoning & Math',
  'Digital Literacy & Security'
];

/**
 * 50 High-Quality Curated and Verified Questions
 */
export const QUESTION_BANK = [
  // Category 1: Science & Nature
  {
    id: 'sci_01',
    category: 'Science & Nature',
    question: 'Which component of blood is primarily responsible for transporting oxygen throughout the human body?',
    options: ['Red blood cells (erythrocytes)', 'White blood cells (leukocytes)', 'Blood platelets (thrombocytes)', 'Blood plasma'],
    correctIndex: 0,
    explanation: 'Red blood cells contain hemoglobin, an iron-rich protein that binds to oxygen in the lungs and delivers it to bodily tissues.'
  },
  {
    id: 'sci_02',
    category: 'Science & Nature',
    question: 'What is the most abundant chemical element in the observable universe by mass?',
    options: ['Hydrogen', 'Helium', 'Carbon', 'Oxygen'],
    correctIndex: 0,
    explanation: 'Hydrogen accounts for roughly 75% of the baryonic mass of the universe, with helium making up nearly all of the remaining 25%.'
  },
  {
    id: 'sci_03',
    category: 'Science & Nature',
    question: 'Which layer of Earth’s atmosphere contains the majority of the planet’s weather phenomena?',
    options: ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere'],
    correctIndex: 0,
    explanation: 'The troposphere extends from Earth’s surface up to approximately 8–15 km and contains about 75% of the atmosphere’s mass and almost all water vapor.'
  },
  {
    id: 'sci_04',
    category: 'Science & Nature',
    question: 'What cellular organelle is responsible for generating the majority of chemical energy (ATP) in eukaryotic cells?',
    options: ['Mitochondria', 'Endoplasmic reticulum', 'Ribosome', 'Golgi apparatus'],
    correctIndex: 0,
    explanation: 'Mitochondria generate adenosine triphosphate (ATP) through cellular respiration, often referred to as the cellular powerhouse.'
  },
  {
    id: 'sci_05',
    category: 'Science & Nature',
    question: 'What physical property dictates that light changes speed and direction when passing from air into water?',
    options: ['Refraction', 'Diffraction', 'Polarization', 'Interference'],
    correctIndex: 0,
    explanation: 'Refraction occurs because light travels at different phase velocities through mediums with differing refractive indices.'
  },
  {
    id: 'sci_06',
    category: 'Science & Nature',
    question: 'Which planet in our solar system boasts the shortest day (fastest rotational period on its axis)?',
    options: ['Jupiter', 'Mercury', 'Venus', 'Mars'],
    correctIndex: 0,
    explanation: 'Jupiter rotates once on its axis in just under 10 hours (approx 9 hours and 55 minutes), the fastest rotation of any planet in our solar system.'
  },
  {
    id: 'sci_07',
    category: 'Science & Nature',
    question: 'What type of chemical bond involves the sharing of electron pairs between atoms?',
    options: ['Covalent bond', 'Ionic bond', 'Hydrogen bond', 'Metallic bond'],
    correctIndex: 0,
    explanation: 'Covalent bonds form when nonmetallic atoms share valence electrons to achieve stable electronic configurations.'
  },
  {
    id: 'sci_08',
    category: 'Science & Nature',
    question: 'In plate tectonics, what type of boundary is formed when two tectonic plates slide horizontally past one another?',
    options: ['Transform boundary', 'Divergent boundary', 'Convergent boundary', 'Subduction zone'],
    correctIndex: 0,
    explanation: 'Transform fault boundaries (such as California’s San Andreas Fault) occur where plates grind horizontally without creating or destroying lithosphere.'
  },
  {
    id: 'sci_09',
    category: 'Science & Nature',
    question: 'Which geological eon marks the origin and earliest fossil evidence of living organisms on Earth?',
    options: ['Archean', 'Phanerozoic', 'Proterozoic', 'Hadean'],
    correctIndex: 0,
    explanation: 'The Archean eon (4.0 to 2.5 billion years ago) preserves the oldest confirmed microfossils and stromatolites of early bacterial life.'
  },
  {
    id: 'sci_10',
    category: 'Science & Nature',
    question: 'Which fundamental force of physics has infinite range and is always attractive, but is the weakest in magnitude?',
    options: ['Gravitational force', 'Weak nuclear force', 'Strong nuclear force', 'Electromagnetic force'],
    correctIndex: 0,
    explanation: 'Gravity operates across infinite distances and is strictly attractive, but is vastly weaker than electromagnetism or the nuclear forces.'
  },

  // Category 2: Technology & Computing
  {
    id: 'tech_01',
    category: 'Technology & Computing',
    question: 'In computer science, what is the average-case time complexity of retrieving an item by key from a standard Hash Table?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 0,
    explanation: 'Hash tables compute a key hash to calculate an array index, giving constant time O(1) retrieval on average when collision rates are low.'
  },
  {
    id: 'tech_02',
    category: 'Technology & Computing',
    question: 'Which networking protocol guarantees ordered, reliable, and error-checked delivery of byte streams between hosts?',
    options: ['TCP (Transmission Control Protocol)', 'UDP (User Datagram Protocol)', 'IP (Internet Protocol)', 'ICMP'],
    correctIndex: 0,
    explanation: 'TCP uses acknowledgments, sequence numbers, and retransmissions to provide guaranteed, in-order packet delivery.'
  },
  {
    id: 'tech_03',
    category: 'Technology & Computing',
    question: 'In public-key cryptography (asymmetric encryption), which key is used by the recipient to decrypt a message?',
    options: ['The recipient’s private key', 'The recipient’s public key', 'The sender’s public key', 'The sender’s private key'],
    correctIndex: 0,
    explanation: 'The sender encrypts the payload using the recipient’s public key, which can only be decrypted by the recipient’s matching private key.'
  },
  {
    id: 'tech_04',
    category: 'Technology & Computing',
    question: 'What does the "ACID" acronym represent in database transaction management?',
    options: ['Atomicity, Consistency, Isolation, Durability', 'Access, Control, Integrity, Delivery', 'Authentication, Cryptography, Identity, Directory', 'Allocation, Compression, Indexing, Deduplication'],
    correctIndex: 0,
    explanation: 'ACID guarantees that database transactions are processed reliably, even in the event of crashes, power failures, or errors.'
  },
  {
    id: 'tech_05',
    category: 'Technology & Computing',
    question: 'Which standard HTTP status code indicates that a server understands the content type of the request entity but was unable to process the contained instructions?',
    options: ['422 Unprocessable Entity', '400 Bad Request', '404 Not Found', '502 Bad Gateway'],
    correctIndex: 0,
    explanation: 'HTTP 422 Unprocessable Entity means the request was syntactically correct (e.g. valid JSON) but contained semantic validation errors.'
  },
  {
    id: 'tech_06',
    category: 'Technology & Computing',
    question: 'What is the purpose of the Domain Name System (DNS) in internet infrastructure?',
    options: ['Translating human-readable domain names into IP addresses', 'Encrypting HTTP traffic over TLS', 'Routing physical fiber optic cables', 'Allocating MAC addresses to network cards'],
    correctIndex: 0,
    explanation: 'DNS serves as the internet’s phonebook, mapping domain names like intellitools.online to machine-readable IP addresses.'
  },
  {
    id: 'tech_07',
    category: 'Technology & Computing',
    question: 'In Git version control, which command creates a new local branch and immediately switches to it in modern Git?',
    options: ['git switch -c <branch>', 'git branch --move <branch>', 'git push origin <branch>', 'git rebase <branch>'],
    correctIndex: 0,
    explanation: 'The command "git switch -c <name>" (or "git checkout -b <name>") creates a new branch pointer and updates HEAD to it.'
  },
  {
    id: 'tech_08',
    category: 'Technology & Computing',
    question: 'What core data structure is used by the call stack in modern language runtime execution engines?',
    options: ['Stack (LIFO - Last In, First Out)', 'Queue (FIFO - First In, First Out)', 'Binary Search Tree', 'Circular Linked List'],
    correctIndex: 0,
    explanation: 'Call stacks use LIFO order: the most recently invoked function sits at the top of the stack and must return before caller execution resumes.'
  },
  {
    id: 'tech_09',
    category: 'Technology & Computing',
    question: 'What mechanism in modern web browsers isolates cookies and local storage to prevent one website from reading data belonging to another origin?',
    options: ['Same-Origin Policy (SOP)', 'Cross-Origin Resource Sharing (CORS)', 'Content Security Policy (CSP)', 'Subresource Integrity (SRI)'],
    correctIndex: 0,
    explanation: 'The Same-Origin Policy (SOP) restricts scripts on one origin (protocol, domain, port) from accessing sensitive DOM or storage data on another.'
  },
  {
    id: 'tech_10',
    category: 'Technology & Computing',
    question: 'In relational databases, what type of index uses balanced tree structures to provide logarithmic lookup time for sorted ranges?',
    options: ['B-Tree Index', 'Bitmap Index', 'Hash Index', 'Full-Text Inverted Index'],
    correctIndex: 0,
    explanation: 'B-Tree indexes maintain sorted keys in balanced nodes, allowing efficient point lookups and range scans in O(log n) time.'
  },

  // Category 3: Geography & World
  {
    id: 'geo_01',
    category: 'Geography & World',
    question: 'What is the capital city of Australia?',
    options: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'],
    correctIndex: 0,
    explanation: 'Canberra was selected as the capital of Australia in 1908 as a compromise between the two largest cities, Sydney and Melbourne.'
  },
  {
    id: 'geo_02',
    category: 'Geography & World',
    question: 'Which strait connects the Atlantic Ocean to the Mediterranean Sea and separates Spain from Morocco?',
    options: ['Strait of Gibraltar', 'Bosphorus Strait', 'Strait of Malacca', 'Strait of Hormuz'],
    correctIndex: 0,
    explanation: 'The Strait of Gibraltar is a narrow waterway approximately 14 km wide at its narrowest point between Europe and Africa.'
  },
  {
    id: 'geo_03',
    category: 'Geography & World',
    question: 'What is the largest inland body of water (by surface area) on Earth, often classified as the world’s largest lake?',
    options: ['Caspian Sea', 'Lake Superior', 'Lake Victoria', 'Lake Baikal'],
    correctIndex: 0,
    explanation: 'The Caspian Sea has an enormous surface area of roughly 371,000 square kilometers, situated between Europe and Asia.'
  },
  {
    id: 'geo_04',
    category: 'Geography & World',
    question: 'Which river flows through the highest number of distinct sovereign nations in the world?',
    options: ['Danube', 'Nile', 'Amazon', 'Rhine'],
    correctIndex: 0,
    explanation: 'The Danube flows through or borders 10 countries in Central and Eastern Europe: Germany, Austria, Slovakia, Hungary, Croatia, Serbia, Romania, Bulgaria, Moldova, and Ukraine.'
  },
  {
    id: 'geo_05',
    category: 'Geography & World',
    question: 'In which mountain range is Mount Everest, the highest peak above sea level, located?',
    options: ['Himalayas', 'Andes', 'Karakoram', 'Alps'],
    correctIndex: 0,
    explanation: 'Mount Everest (8,848.86 m) is located in the Mahalangur Himal sub-range of the Himalayas on the border between Nepal and China.'
  },
  {
    id: 'geo_06',
    category: 'Geography & World',
    question: 'Which island nation in East Africa is the fourth largest island in the world and home to 90% endemic wildlife?',
    options: ['Madagascar', 'Mauritius', 'Seychelles', 'Comoros'],
    correctIndex: 0,
    explanation: 'Madagascar split from the Indian subcontinent over 80 million years ago, allowing unique native plants and animals like lemurs to evolve in isolation.'
  },
  {
    id: 'geo_07',
    category: 'Geography & World',
    question: 'What is the only country in the world that borders both the Mediterranean Sea and the Red Sea?',
    options: ['Egypt', 'Israel', 'Saudi Arabia', 'Sudan'],
    correctIndex: 0,
    explanation: 'Egypt features coastlines on both the Mediterranean to the north and the Red Sea to the east, connected by the Suez Canal.'
  },
  {
    id: 'geo_08',
    category: 'Geography & World',
    question: 'What is the deepest terrestrial lake on Earth, containing approximately 20% of the world’s unfrozen surface fresh water?',
    options: ['Lake Baikal', 'Lake Tanganyika', 'Crater Lake', 'Lake Tahoe'],
    correctIndex: 0,
    explanation: 'Lake Baikal in southern Siberia reaches a maximum depth of 1,642 meters (5,387 ft), making it the world’s oldest and deepest freshwater lake.'
  },
  {
    id: 'geo_09',
    category: 'Geography & World',
    question: 'Which South American country is home to the Atacama Desert, one of the driest non-polar places on Earth?',
    options: ['Chile', 'Argentina', 'Bolivia', 'Peru'],
    correctIndex: 0,
    explanation: 'The Atacama Desert stretches along northern Chile between the Pacific Ocean and the Andes Mountains.'
  },
  {
    id: 'geo_10',
    category: 'Geography & World',
    question: 'Which line of latitude circles the globe at approximately 23.5 degrees North of the equator?',
    options: ['Tropic of Cancer', 'Tropic of Capricorn', 'Arctic Circle', 'Prime Meridian'],
    correctIndex: 0,
    explanation: 'The Tropic of Cancer is the northernmost latitude on Earth where the sun can appear directly overhead at solar noon.'
  },

  // Category 4: Logical Reasoning & Math
  {
    id: 'log_01',
    category: 'Logical Reasoning & Math',
    question: 'If all Zips are Zaps, and some Zaps are Zops, which of the following statements MUST logically be true?',
    options: ['None of the options necessarily follows', 'All Zips are Zops', 'Some Zips are Zops', 'No Zips are Zops'],
    correctIndex: 0,
    explanation: 'Because only *some* Zaps are Zops, those Zops may or may not overlap with the Zips subset. Therefore, none of the specific overlap statements is guaranteed to be true.'
  },
  {
    id: 'log_02',
    category: 'Logical Reasoning & Math',
    question: 'What is the next number in the sequence: 2, 6, 12, 20, 30, 42, ...?',
    options: ['56', '54', '52', '58'],
    correctIndex: 0,
    explanation: 'The increments between consecutive terms increase by 2: +4, +6, +8, +10, +12. Adding 14 to 42 gives 56 (or n * (n+1) where n=7 gives 7*8=56).'
  },
  {
    id: 'log_03',
    category: 'Logical Reasoning & Math',
    question: 'In probability theory, what is the probability of rolling a sum of 7 when rolling two fair six-sided dice simultaneously?',
    options: ['1/6 (approx 16.7%)', '1/12 (approx 8.3%)', '1/4 (25%)', '7/36 (approx 19.4%)'],
    correctIndex: 0,
    explanation: 'There are 6 combinations that sum to 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) out of 36 possible outcomes: 6/36 = 1/6.'
  },
  {
    id: 'log_04',
    category: 'Logical Reasoning & Math',
    question: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
    options: ['$0.05 (5 cents)', '$0.10 (10 cents)', '$0.01 (1 cent)', '$0.15 (15 cents)'],
    correctIndex: 0,
    explanation: 'Let ball = x. Bat = x + 1.00. x + (x + 1.00) = 1.10 -> 2x = 0.10 -> x = $0.05. The bat costs $1.05, totaling $1.10.'
  },
  {
    id: 'log_05',
    category: 'Logical Reasoning & Math',
    question: 'In formal propositional logic, what is the contrapositive of the conditional statement "If P, then Q"?',
    options: ['If not Q, then not P', 'If Q, then P', 'If not P, then not Q', 'P and not Q'],
    correctIndex: 0,
    explanation: 'The contrapositive of "P implies Q" is "not Q implies not P", and it is logically equivalent to the original conditional statement.'
  },
  {
    id: 'log_06',
    category: 'Logical Reasoning & Math',
    question: 'What is the sum of the interior angles of any planar hexagon (6-sided polygon)?',
    options: ['720 degrees', '540 degrees', '900 degrees', '360 degrees'],
    correctIndex: 0,
    explanation: 'The formula for the sum of interior angles of an n-sided polygon is (n - 2) * 180. For n=6: (6 - 2) * 180 = 4 * 180 = 720 degrees.'
  },
  {
    id: 'log_07',
    category: 'Logical Reasoning & Math',
    question: 'If five machines take 5 minutes to make 5 widgets, how many minutes would 100 machines take to make 100 widgets?',
    options: ['5 minutes', '100 minutes', '20 minutes', '1 minute'],
    correctIndex: 0,
    explanation: 'Each machine produces 1 widget every 5 minutes. Therefore, 100 machines working in parallel will each produce 1 widget in 5 minutes, yielding 100 widgets.'
  },
  {
    id: 'log_08',
    category: 'Logical Reasoning & Math',
    question: 'What is the smallest positive integer that is evenly divisible by all numbers from 1 through 10?',
    options: ['2520', '5040', '1260', '840'],
    correctIndex: 0,
    explanation: 'The least common multiple of numbers 1 through 10 is 2^3 * 3^2 * 5 * 7 = 8 * 9 * 5 * 7 = 2520.'
  },
  {
    id: 'log_09',
    category: 'Logical Reasoning & Math',
    question: 'In set theory, what is the cardinality of the power set of a set containing exactly 4 elements?',
    options: ['16', '8', '12', '24'],
    correctIndex: 0,
    explanation: 'The power set of any finite set with n elements contains 2^n subsets. For n=4, 2^4 = 16.'
  },
  {
    id: 'log_10',
    category: 'Logical Reasoning & Math',
    question: 'Which mathematical term describes a number that cannot be expressed as a ratio of two integers (e.g. pi or the square root of 2)?',
    options: ['Irrational number', 'Rational number', 'Complex number', 'Prime number'],
    correctIndex: 0,
    explanation: 'An irrational number cannot be written as a simple fraction a/b; its decimal representation never terminates and never repeats.'
  },

  // Category 5: Digital Literacy & Security
  {
    id: 'sec_01',
    category: 'Digital Literacy & Security',
    question: 'What security principle dictates that users and applications should only be granted the minimum permissions necessary to complete their duties?',
    options: ['Principle of Least Privilege (PoLP)', 'Defense in Depth', 'Zero Trust Architecture', 'Separation of Concerns'],
    correctIndex: 0,
    explanation: 'The Principle of Least Privilege limits damage from accidental misconfigurations or compromised credentials by minimizing access rights.'
  },
  {
    id: 'sec_02',
    category: 'Digital Literacy & Security',
    question: 'Which multi-factor authentication (MFA) method is considered most resilient against real-time phishing and adversary-in-the-middle attacks?',
    options: ['FIDO2 / WebAuthn Hardware Security Keys', 'SMS Text Message OTP', 'Email Verification Codes', 'Time-based Authenticator Apps (TOTP)'],
    correctIndex: 0,
    explanation: 'FIDO2 / WebAuthn protocols cryptographically bind authentication credentials to the website origin, preventing phishing proxies from replaying credentials.'
  },
  {
    id: 'sec_03',
    category: 'Digital Literacy & Security',
    question: 'What is the primary technical difference between hashing and encryption in information security?',
    options: ['Hashing is a one-way transformation; encryption is a two-way reversible process', 'Hashing requires a secret key; encryption does not', 'Encryption is faster and produces fixed-length outputs', 'Hashing can be reversed with a private key'],
    correctIndex: 0,
    explanation: 'Cryptographic hash functions generate fixed-size digests that cannot be mathematically reversed to recover the input. Encryption is designed to be decrypted with the appropriate key.'
  },
  {
    id: 'sec_04',
    category: 'Digital Literacy & Security',
    question: 'What web security vulnerability occurs when an attacker tricks an authenticated user’s browser into submitting an unauthorized request to a trusted application?',
    options: ['Cross-Site Request Forgery (CSRF)', 'Cross-Site Scripting (XSS)', 'SQL Injection', 'Server-Side Request Forgery (SSRF)'],
    correctIndex: 0,
    explanation: 'CSRF exploits the browser’s automatic inclusion of stored session credentials (such as cookies) to perform unwanted actions on behalf of the victim.'
  },
  {
    id: 'sec_05',
    category: 'Digital Literacy & Security',
    question: 'Why is client-side input validation alone insufficient to protect a web application?',
    options: ['Client-side code can be modified, bypassed, or disabled by an attacker', 'Client-side validation only works on HTTPS connections', 'Web browsers automatically strip client validation scripts', 'Client validation is incompatible with modern mobile browsers'],
    correctIndex: 0,
    explanation: 'An attacker can easily bypass client-side checks using direct HTTP requests (via cURL, Postman, or dev tools). Servers must always re-validate all incoming data.'
  },
  {
    id: 'sec_06',
    category: 'Digital Literacy & Security',
    question: 'What type of digital certificate establishes encrypted HTTPS communication between a client browser and a website server?',
    options: ['TLS / SSL Certificate', 'SSH Key Pair', 'Code Signing Certificate', 'PGP Identity Ring'],
    correctIndex: 0,
    explanation: 'TLS certificates authenticate the server’s identity and facilitate cryptographic session key exchange for HTTPS encryption.'
  },
  {
    id: 'sec_07',
    category: 'Digital Literacy & Security',
    question: 'What does the browser header "Content-Security-Policy (CSP)" primarily defend against?',
    options: ['Cross-Site Scripting (XSS) and malicious script injection', 'DDoS volumetric attacks', 'Password brute-forcing', 'Man-in-the-Middle Wi-Fi eavesdropping'],
    correctIndex: 0,
    explanation: 'CSP enables developers to restrict the sources from which scripts, images, and other subresources can be loaded and executed in the browser.'
  },
  {
    id: 'sec_08',
    category: 'Digital Literacy & Security',
    question: 'What is a "passkey" as defined by the FIDO Alliance and W3C standards?',
    options: ['A passwordless cryptographic credential stored securely on user devices', 'A 16-character master password generated by a password manager', 'A temporary one-time password sent via push notification', 'A shared secret stored in browser cookies'],
    correctIndex: 0,
    explanation: 'Passkeys replace traditional passwords with asymmetric public-key cryptography tied to biometric device unlocking (like Face ID or fingerprint).'
  },
  {
    id: 'sec_09',
    category: 'Digital Literacy & Security',
    question: 'In modern password security guidelines (NIST SP 800-63B), which practice is explicitly discouraged for general user accounts?',
    options: ['Arbitrary mandatory periodic password changes (e.g. every 90 days)', 'Using multi-word passphrases', 'Checking passwords against known breach databases', 'Adopting multi-factor authentication'],
    correctIndex: 0,
    explanation: 'NIST guidelines discourage forced periodic rotation without evidence of compromise, as it frequently causes users to pick predictable variants of old passwords.'
  },
  {
    id: 'sec_10',
    category: 'Digital Literacy & Security',
    question: 'What is "typosquatting" in the context of cyber threats?',
    options: ['Registering domains that mimic common misspellings of popular sites to trick users', 'Injecting keystroke logging malware into keyboards', 'Using OCR to extract text from screenshots', 'Spoofing DNS root servers during queries'],
    correctIndex: 0,
    explanation: 'Typosquatting targets users who make typographical errors when typing URLs into browser address bars, redirecting them to malicious clone sites.'
  }
];

/**
 * Returns current date string in UTC (YYYY-MM-DD)
 */
export function getUtcDateString(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Simple, deterministic linear congruential hash of string
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically selects exactly 5 questions for a given date
 * One question from each of the 5 distinct categories!
 */
export function getDailyQuestions(dateStr = getUtcDateString()) {
  const seed = hashString(`intellitools-daily-v5-${dateStr}`);
  const selected = [];

  QUESTION_CATEGORIES.forEach((cat, catIdx) => {
    const candidates = QUESTION_BANK.filter(q => q.category === cat);
    if (candidates.length === 0) return;

    // Deterministic index for this category on this date
    const catSeed = (seed + catIdx * 1337) >>> 0;
    const chosenIdx = catSeed % candidates.length;
    const baseQ = candidates[chosenIdx];

    // Shuffle options deterministically
    const optSeed = (catSeed * 31) >>> 0;
    const indices = [0, 1, 2, 3];
    // Fisher-Yates deterministic shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = (optSeed + i * 17) % (i + 1);
      const temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }

    const shuffledOptions = indices.map(origIdx => baseQ.options[origIdx]);
    const newCorrectIndex = indices.indexOf(baseQ.correctIndex);

    selected.push({
      id: baseQ.id,
      category: baseQ.category,
      question: baseQ.question,
      options: shuffledOptions,
      correctIndex: newCorrectIndex,
      explanation: baseQ.explanation
    });
  });

  return selected;
}

/**
 * Calculates updated streak stats
 */
export function calculateUpdatedStreak(currentStats, dateStr, score, totalQuestions = 5) {
  const stats = currentStats || {
    currentStreak: 0,
    maxStreak: 0,
    totalPlayed: 0,
    totalCorrect: 0,
    history: {}
  };

  const isWin = score >= Math.ceil(totalQuestions * 0.6); // 3+ out of 5 considered win

  // Check if yesterday was played
  const todayDate = new Date(dateStr + 'T00:00:00Z');
  const yesterday = new Date(todayDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = getUtcDateString(yesterday);

  let newCurrentStreak = stats.currentStreak || 0;
  if (stats.history && stats.history[yesterdayStr]) {
    newCurrentStreak += 1;
  } else {
    newCurrentStreak = 1;
  }

  const newMaxStreak = Math.max(stats.maxStreak || 0, newCurrentStreak);

  const updatedHistory = {
    ...(stats.history || {}),
    [dateStr]: {
      score,
      totalQuestions,
      completedAt: new Date().toISOString()
    }
  };

  return {
    currentStreak: newCurrentStreak,
    maxStreak: newMaxStreak,
    totalPlayed: (stats.totalPlayed || 0) + 1,
    totalCorrect: (stats.totalCorrect || 0) + score,
    history: updatedHistory
  };
}

/**
 * Generates privacy-preserving share card text
 */
export function generateShareCard(dateStr, score, total = 5, answerResults = []) {
  let grid = '';
  if (answerResults && answerResults.length > 0) {
    grid = answerResults.map(r => r ? '🟩' : '🟥').join('');
  } else {
    grid = '🟩'.repeat(score) + '🟥'.repeat(total - score);
  }

  const pct = Math.round((score / total) * 100);
  return `IntelliTools Daily Challenge (${dateStr})\nScore: ${score}/${total} (${pct}%)\n${grid}\nhttps://intellitools.online/play/daily/`;
}
