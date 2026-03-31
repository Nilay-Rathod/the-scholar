// Sample seed data for all IELTS skills — used as fallback when API key is missing

import type { WritingTask, ReadingPassage, SpeakingTask, ListeningTask } from '../services/geminiService';

// ======================== WRITING ========================
export const sampleWritingTask1: WritingTask = {
  id: 'seed-w1',
  type: 1,
  prompt: 'The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
  data: [
    { label: '1918', value: 23, category: 'Owned' },
    { label: '1918', value: 77, category: 'Rented' },
    { label: '1939', value: 32, category: 'Owned' },
    { label: '1939', value: 68, category: 'Rented' },
    { label: '1971', value: 51, category: 'Owned' },
    { label: '1971', value: 49, category: 'Rented' },
    { label: '2001', value: 69, category: 'Owned' },
    { label: '2001', value: 31, category: 'Rented' },
    { label: '2011', value: 64, category: 'Owned' },
    { label: '2011', value: 36, category: 'Rented' },
  ]
};

export const sampleWritingTask2: WritingTask = {
  id: 'seed-w2',
  type: 2,
  prompt: 'Some people believe that universities should focus on providing academic skills and theoretical knowledge. Others think they should prepare students for the world of work through practical training and career-oriented courses.\n\nDiscuss both these views and give your own opinion.\n\nWrite at least 250 words.'
};

// ======================== READING ========================
export const sampleReadingPassage: ReadingPassage = {
  id: 'seed-r1',
  title: 'The Rise of Urban Farming',
  content: `Urban farming, also known as urban agriculture, refers to the practice of cultivating, processing, and distributing food in or around urban areas. While the concept is not new — city dwellers have grown food in small plots for centuries — the modern movement has gained significant momentum in recent decades due to concerns about food security, environmental sustainability, and community well-being.

One of the primary drivers of urban farming is the growing awareness of the environmental costs associated with conventional agriculture. Industrial farming operations are responsible for significant greenhouse gas emissions, deforestation, and water pollution. By growing food closer to where it is consumed, urban farming can reduce the carbon footprint associated with transporting produce over long distances, a concept often referred to as "food miles."

In cities such as Detroit, Singapore, and Tokyo, innovative urban farming projects have demonstrated the viability of growing substantial quantities of food within city limits. Vertical farms, which use stacked layers of crops grown indoors under controlled conditions, have emerged as a particularly promising approach. These facilities can produce yields up to 350 times greater per square metre than traditional farms, while using 95% less water through recirculating hydroponic systems.

Community gardens represent another important facet of urban agriculture. These shared spaces allow residents to grow their own fruit and vegetables, fostering social connections and improving access to fresh produce in neighbourhoods that might otherwise be classified as "food deserts" — areas with limited access to affordable, nutritious food. Research has shown that participation in community gardens is associated with increased fruit and vegetable consumption, improved mental health, and stronger neighbourhood cohesion.

However, urban farming faces several challenges. Land in cities is expensive and often contaminated with pollutants from prior industrial use. Zoning regulations may restrict agricultural activities in certain areas. Additionally, the economic viability of urban farms remains a subject of debate; while they can reduce food miles and provide fresh produce, the costs of urban real estate, energy for indoor growing, and labour can make urban-grown food more expensive than conventionally farmed alternatives.

Despite these obstacles, proponents argue that the benefits of urban farming extend beyond simple economics. By reconnecting city residents with the process of food production, urban agriculture can promote healthier eating habits, provide educational opportunities, and contribute to the greening of urban environments. As cities continue to grow, the integration of food production into urban planning is likely to become an increasingly important consideration for policymakers and planners alike.`,
  questions: [
    { id: 'r1q1', text: 'What does the term "food miles" refer to?', type: 'mcq', options: ['A) The distance food travels from farm to consumer', 'B) The number of miles a farmer walks each day', 'C) The speed at which food is delivered', 'D) The distance between urban farms'], answer: 'A) The distance food travels from farm to consumer' },
    { id: 'r1q2', text: 'According to the passage, vertical farms can produce up to _____ times greater yields per square metre than traditional farms.', type: 'gap-fill', answer: '350' },
    { id: 'r1q3', text: 'What percentage less water do hydroponic systems use compared to traditional farming?', type: 'gap-fill', answer: '95' },
    { id: 'r1q4', text: 'What is a "food desert"?', type: 'mcq', options: ['A) A desert used for farming', 'B) An area with limited access to affordable, nutritious food', 'C) A region where no plants can grow', 'D) A supermarket chain'], answer: 'B) An area with limited access to affordable, nutritious food' },
    { id: 'r1q5', text: 'Which of the following is NOT mentioned as a challenge facing urban farming?', type: 'mcq', options: ['A) Expensive urban land', 'B) Soil contamination', 'C) Lack of sunlight', 'D) Zoning regulations'], answer: 'C) Lack of sunlight' },
  ]
};

export const sampleReadingPassage2: ReadingPassage = {
  id: 'seed-r2',
  title: 'The Psychology of Colour in Marketing',
  content: `Colour is one of the most powerful tools in a marketer's arsenal, yet its influence on consumer behaviour is often underestimated. Research suggests that up to 90% of snap judgements about products can be based on colour alone, and that colour increases brand recognition by up to 80%. Understanding the psychology behind colour choices can be the difference between a product that sells and one that gathers dust on the shelf.

The relationship between colour and emotion is complex and influenced by a variety of factors, including cultural background, personal experience, and context. However, certain general associations have been consistently documented across multiple studies. Red, for instance, is commonly associated with urgency, excitement, and passion, which is why it is frequently used in clearance sales and fast-food branding. Blue, on the other hand, evokes feelings of trust, security, and calm, making it the colour of choice for banks, insurance companies, and social media platforms.

Green has strong associations with nature, health, and tranquillity. It is increasingly used by brands that wish to communicate environmental responsibility or organic credentials. Yellow is associated with optimism and warmth but can also create feelings of anxiety when overused. Black communicates luxury, sophistication, and exclusivity, which explains its prevalence in high-end fashion and technology branding.

One particularly interesting aspect of colour psychology is the "isolation effect," also known as the Von Restorff effect. This principle suggests that an item that "stands out like a sore thumb" is more likely to be remembered. In practical marketing terms, this means that a call-to-action button in a contrasting colour to the rest of a webpage will attract more clicks. Studies have shown that changing a button colour from green to red can increase conversion rates by as much as 21%.

The cultural dimension of colour perception adds another layer of complexity. While white is associated with purity and cleanliness in Western cultures, it is the colour of mourning in many East Asian countries. Similarly, red symbolises good fortune in China but can signify danger or warning in Western contexts. Global brands must navigate these cultural differences carefully when developing international marketing campaigns.

Despite the wealth of research on colour psychology, marketers should be cautious about oversimplifying the relationship between colour and consumer behaviour. The most effective colour for any given product or campaign depends on a multitude of factors, including the target audience, the competitive landscape, and the overall brand identity. Rather than following generic rules, successful brands develop colour strategies that align with their unique positioning and resonate with their specific customer base.`,
  questions: [
    { id: 'r2q1', text: 'What percentage of snap judgements about products can be based on colour alone?', type: 'gap-fill', answer: '90' },
    { id: 'r2q2', text: 'Which colour is most commonly used by banks and insurance companies?', type: 'mcq', options: ['A) Red', 'B) Green', 'C) Blue', 'D) Yellow'], answer: 'C) Blue' },
    { id: 'r2q3', text: 'The Von Restorff effect is also known as the _____ effect.', type: 'gap-fill', answer: 'isolation' },
    { id: 'r2q4', text: 'In which culture is white associated with mourning?', type: 'mcq', options: ['A) Western cultures', 'B) East Asian countries', 'C) South American cultures', 'D) African cultures'], answer: 'B) East Asian countries' },
    { id: 'r2q5', text: 'By how much can changing a button colour from green to red increase conversion rates?', type: 'mcq', options: ['A) 11%', 'B) 15%', 'C) 21%', 'D) 30%'], answer: 'C) 21%' },
  ]
};

export const sampleReadingPassage3: ReadingPassage = {
  id: 'seed-r3',
  title: 'Sleep and Memory Consolidation',
  content: `The relationship between sleep and memory has been a subject of scientific inquiry for over a century. While the precise mechanisms by which sleep supports memory remain a matter of active research, a growing body of evidence suggests that sleep plays a critical role in the consolidation of newly acquired information — the process by which fragile, recently formed memories are transformed into stable, long-term representations.

Memory consolidation during sleep is thought to involve the reactivation of neural patterns that were active during the original learning experience. Studies using functional magnetic resonance imaging (fMRI) have shown that brain regions activated during a learning task are spontaneously reactivated during subsequent sleep, particularly during slow-wave sleep (SWS), the deepest stage of non-rapid eye movement (NREM) sleep. This reactivation is believed to facilitate the gradual transfer of memories from the hippocampus, a brain structure crucial for the initial encoding of new experiences, to the neocortex, where they are integrated into existing knowledge networks.

Different stages of sleep appear to benefit different types of memory. Declarative memories — factual knowledge such as vocabulary words or historical dates — seem to benefit primarily from slow-wave sleep. In contrast, procedural memories — skills such as playing a musical instrument or riding a bicycle — appear to be enhanced by rapid eye movement (REM) sleep, the stage characterised by vivid dreaming.

The importance of sleep for memory has significant implications for education. Students who sacrifice sleep for additional study time may actually be undermining their ability to retain the material they have learned. Research has demonstrated that students who sleep after learning new information perform significantly better on subsequent tests compared to those who remain awake for an equivalent period. One study found that a 90-minute nap after learning improved recall by approximately 20% compared to an equivalent period of wakefulness.

Sleep deprivation has been shown to impair not only the consolidation of new memories but also the initial encoding process itself. An individual who has been awake for 24 hours shows a 40% deficit in the ability to form new memories, comparable to being legally intoxicated. This finding has important implications for professionals who work long shifts, such as medical residents and airline pilots, where the ability to learn and remember critical information can be a matter of life and death.

In recent years, researchers have begun to explore the possibility of enhancing memory consolidation during sleep through targeted interventions. Techniques such as targeted memory reactivation (TMR), which involves presenting cues associated with previously learned material during sleep, have shown promising results in laboratory settings.`,
  questions: [
    { id: 'r3q1', text: 'During which stage of sleep does the reactivation of learning-related neural patterns primarily occur?', type: 'mcq', options: ['A) REM sleep', 'B) Light sleep', 'C) Slow-wave sleep (SWS)', 'D) Stage 1 NREM'], answer: 'C) Slow-wave sleep (SWS)' },
    { id: 'r3q2', text: 'Which brain structure is crucial for the initial encoding of new experiences?', type: 'gap-fill', answer: 'hippocampus' },
    { id: 'r3q3', text: 'By what percentage did a 90-minute nap improve recall compared to wakefulness?', type: 'gap-fill', answer: '20' },
    { id: 'r3q4', text: 'What type of memory benefits primarily from REM sleep?', type: 'mcq', options: ['A) Declarative memory', 'B) Procedural memory', 'C) Episodic memory', 'D) Semantic memory'], answer: 'B) Procedural memory' },
    { id: 'r3q5', text: 'A person awake for 24 hours shows a _____% deficit in forming new memories.', type: 'gap-fill', answer: '40' },
  ]
};

// ======================== LISTENING ========================
export const sampleListeningSections: ListeningTask[] = [
  {
    id: 'seed-l1',
    section: 1,
    title: 'Section 1: University Library Orientation',
    transcript: `Good morning, everyone. Welcome to the university library orientation. My name is Sarah, and I'll be your guide today. Before we begin the tour, let me give you some important information about the library services.\n\nThe library is open from 8 AM to 10 PM on weekdays, and from 9 AM to 6 PM on weekends. During exam periods, we extend our hours until midnight. You can borrow up to 12 books at a time with your student ID card. The loan period is 3 weeks for regular books and 1 week for reference materials.\n\nWe also have a digital resources section on the second floor, where you can access over 50,000 online journals and databases. If you need help with research, our librarians offer free one-on-one consultations. You can book these through our website or at the information desk on the ground floor.\n\nNow, let me show you the different sections. The ground floor has the circulation desk, the periodicals section, and a café. The first floor is dedicated to sciences and technology. The second floor houses humanities and social sciences. And the third floor has our special collections and quiet study rooms.\n\nOne important rule: food and drinks are only allowed in the café area on the ground floor. Please keep your mobile phones on silent mode throughout the library. Group study rooms on the third floor can be booked for up to 4 hours at a time, and you need at least 3 people to make a booking.`,
    questions: [
      { id: 'l1q1', text: 'The library closes at _____ PM on weekdays.', type: 'gap-fill', answer: '10' },
      { id: 'l1q2', text: 'How many books can students borrow at one time?', type: 'mcq', options: ['8', '10', '12', '15'], answer: '12' },
      { id: 'l1q3', text: 'The loan period for regular books is _____ weeks.', type: 'gap-fill', answer: '3' },
      { id: 'l1q4', text: 'How many online journals does the library provide access to?', type: 'mcq', options: ['30,000', '40,000', '50,000', '60,000'], answer: '50,000' },
      { id: 'l1q5', text: 'The sciences and technology section is on the _____ floor.', type: 'gap-fill', answer: 'first' },
      { id: 'l1q6', text: 'What is located on the third floor?', type: 'mcq', options: ['The café', 'Sciences and technology', 'Special collections and quiet study rooms', 'Periodicals'], answer: 'Special collections and quiet study rooms' },
      { id: 'l1q7', text: 'The reference material loan period is _____ week(s).', type: 'gap-fill', answer: '1' },
      { id: 'l1q8', text: 'Where can research consultations be booked?', type: 'mcq', options: ['Only online', 'At the café', 'Through the website or information desk', 'On the third floor'], answer: 'Through the website or information desk' },
      { id: 'l1q9', text: 'Group study rooms require at least _____ people to book.', type: 'gap-fill', answer: '3' },
      { id: 'l1q10', text: 'During exam periods, the library stays open until:', type: 'mcq', options: ['10 PM', '11 PM', 'Midnight', '2 AM'], answer: 'Midnight' },
    ]
  },
  {
    id: 'seed-l2',
    section: 2,
    title: 'Section 2: Accommodation Services at Greenfield University',
    transcript: `Welcome to the Greenfield University accommodation office. I'm David, and I'll be helping you with your housing application today.\n\nWe have three main types of student accommodation. First, there are the on-campus halls of residence. These cost £145 per week and include all utilities — water, electricity, heating, and internet. Each room comes with a single bed, a desk, a wardrobe, and a small bookshelf. Bathrooms are shared between 6 students.\n\nSecond, we have self-catered apartments located about a 10-minute walk from the main campus. These are £120 per week, but you'll need to budget an extra £25 per week for utilities. Each apartment has 4 bedrooms, a shared kitchen, and 2 bathrooms. These apartments also have a small garden.\n\nFinally, we have our homestay programme. This is where you live with a local family. The cost is £160 per week, and that includes breakfast and dinner. This is particularly popular with international students who want to improve their English and experience British culture.\n\nAll accommodation options require a security deposit of £300, which is refundable at the end of your stay, provided there is no damage. The application deadline for the autumn semester is July 15th. For the spring semester, it's November 30th.\n\nIf you need any assistance with your application, our office is open Monday to Friday from 9 AM to 5 PM. You can also reach us by email at housing@greenfield.ac.uk.`,
    questions: [
      { id: 'l2q1', text: 'On-campus halls of residence cost £_____ per week.', type: 'gap-fill', answer: '145' },
      { id: 'l2q2', text: 'How many students share a bathroom in the halls of residence?', type: 'mcq', options: ['4', '6', '8', '10'], answer: '6' },
      { id: 'l2q3', text: 'Self-catered apartments are located about a _____-minute walk from campus.', type: 'gap-fill', answer: '10' },
      { id: 'l2q4', text: 'How much are utilities for the self-catered apartments per week?', type: 'mcq', options: ['£15', '£20', '£25', '£30'], answer: '£25' },
      { id: 'l2q5', text: 'Each self-catered apartment has _____ bedrooms.', type: 'gap-fill', answer: '4' },
      { id: 'l2q6', text: 'What meals are included in the homestay programme?', type: 'mcq', options: ['Breakfast only', 'Dinner only', 'Breakfast and dinner', 'All three meals'], answer: 'Breakfast and dinner' },
      { id: 'l2q7', text: 'The security deposit is £_____.', type: 'gap-fill', answer: '300' },
      { id: 'l2q8', text: 'What is the application deadline for the autumn semester?', type: 'mcq', options: ['June 15th', 'July 15th', 'August 15th', 'September 1st'], answer: 'July 15th' },
      { id: 'l2q9', text: 'The homestay programme costs £_____ per week.', type: 'gap-fill', answer: '160' },
      { id: 'l2q10', text: 'The accommodation office is open from:', type: 'mcq', options: ['8 AM to 4 PM', '9 AM to 5 PM', '9 AM to 6 PM', '10 AM to 4 PM'], answer: '9 AM to 5 PM' },
    ]
  },
  {
    id: 'seed-l3',
    section: 3,
    title: 'Section 3: Lecture on Marine Biology — Coral Reef Ecosystems',
    transcript: `Good afternoon, class. Today we'll be continuing our series on marine biology by looking at coral reef ecosystems in more detail.\n\nCoral reefs are often referred to as the "rainforests of the sea" because they support approximately 25% of all marine species, despite covering less than 1% of the ocean floor. The largest coral reef system in the world is the Great Barrier Reef, which stretches over 2,300 kilometres along the northeast coast of Australia.\n\nCoral reefs are built by tiny animals called coral polyps. These polyps secrete calcium carbonate, which forms the hard, rock-like structure of the reef. The growth rate of coral is remarkably slow — most reef-building corals grow between 1 and 3 centimetres per year. This means that large reef formations can take thousands or even millions of years to develop.\n\nOne of the key relationships in coral reef ecosystems is the symbiotic partnership between coral polyps and microscopic algae called zooxanthellae. These algae live within the tissues of the coral and provide up to 90% of the coral's energy through photosynthesis. In return, the coral provides the algae with a protected environment and access to essential nutrients.\n\nCoral bleaching occurs when corals are stressed, typically by rising water temperatures. When the water temperature increases by just 1 to 2 degrees Celsius above the normal summer maximum, the coral expels the zooxanthellae, causing the coral to turn white. If the stress continues for more than 8 weeks, the coral may die.\n\nAccording to the latest research, approximately 14% of the world's coral was lost between 2009 and 2018. Scientists predict that if current trends continue, we could lose up to 90% of the world's coral reefs by 2050. Conservation efforts include establishing marine protected areas, reducing agricultural runoff, and developing heat-resistant coral strains through selective breeding programmes.`,
    questions: [
      { id: 'l3q1', text: 'Coral reefs support approximately _____% of all marine species.', type: 'gap-fill', answer: '25' },
      { id: 'l3q2', text: 'How long is the Great Barrier Reef?', type: 'mcq', options: ['1,300 km', '1,800 km', '2,300 km', '3,000 km'], answer: '2,300 km' },
      { id: 'l3q3', text: 'Coral polyps secrete _____ to build reef structures.', type: 'gap-fill', answer: 'calcium carbonate' },
      { id: 'l3q4', text: 'Most reef-building corals grow between 1 and _____ centimetres per year.', type: 'gap-fill', answer: '3' },
      { id: 'l3q5', text: 'What percentage of coral energy is provided by zooxanthellae?', type: 'mcq', options: ['50%', '70%', '80%', '90%'], answer: '90%' },
      { id: 'l3q6', text: 'Coral bleaching is primarily caused by:', type: 'mcq', options: ['Ocean acidification', 'Rising water temperatures', 'Overfishing', 'Pollution'], answer: 'Rising water temperatures' },
      { id: 'l3q7', text: 'Coral may die if bleaching stress continues for more than _____ weeks.', type: 'gap-fill', answer: '8' },
      { id: 'l3q8', text: 'What percentage of coral was lost between 2009 and 2018?', type: 'mcq', options: ['7%', '10%', '14%', '20%'], answer: '14%' },
      { id: 'l3q9', text: 'By 2050, we could lose up to _____% of the world\'s coral reefs.', type: 'gap-fill', answer: '90' },
      { id: 'l3q10', text: 'Which is NOT mentioned as a conservation effort?', type: 'mcq', options: ['Marine protected areas', 'Reducing agricultural runoff', 'Developing heat-resistant corals', 'Banning tourist access to reefs'], answer: 'Banning tourist access to reefs' },
    ]
  },
  {
    id: 'seed-l4',
    section: 4,
    title: 'Section 4: Academic Discussion — The Future of Renewable Energy',
    transcript: `Today I'd like to examine the current state and future prospects of renewable energy, with particular focus on the economic and technological factors that will shape the transition away from fossil fuels.\n\nGlobal investment in renewable energy reached $366 billion in 2023, a figure that represents a 17% increase from the previous year. Solar power attracted the largest share of investment at 48%, followed by wind energy at 35%. The remaining 17% was distributed among hydroelectric, geothermal, and biomass technologies.\n\nThe cost of solar photovoltaic panels has declined by approximately 89% since 2010. This dramatic reduction in cost has made solar energy competitive with fossil fuels in many parts of the world. In some regions, such as the Middle East and parts of South America, solar electricity is now the cheapest form of energy generation available.\n\nHowever, the intermittent nature of renewable energy sources presents a significant challenge. Solar panels only generate electricity during daylight hours, and wind turbines require consistent wind speeds of at least 12 kilometres per hour to operate efficiently. This variability necessitates the development of energy storage solutions. Currently, lithium-ion batteries are the dominant storage technology, but their capacity degrades by approximately 2.5% per year.\n\nResearchers are developing alternative storage technologies to address these limitations. Solid-state batteries, which could offer 2 to 3 times the energy density of lithium-ion batteries, are expected to reach commercial production by 2028. Another promising technology is green hydrogen, produced by using renewable electricity to split water molecules. This hydrogen can be stored and later converted back to electricity through fuel cells, with water being the only by-product.\n\nThe transition to renewable energy is expected to create approximately 42 million new jobs globally by 2050, while approximately 12 million jobs in the fossil fuel industry are projected to be displaced. Government policies, including carbon pricing mechanisms and renewable energy subsidies, will play a crucial role in determining the pace and scale of this transition.`,
    questions: [
      { id: 'l4q1', text: 'Global investment in renewable energy reached $_____ billion in 2023.', type: 'gap-fill', answer: '366' },
      { id: 'l4q2', text: 'What percentage of investment went to solar power?', type: 'mcq', options: ['35%', '42%', '48%', '55%'], answer: '48%' },
      { id: 'l4q3', text: 'Solar panel costs have declined by approximately _____% since 2010.', type: 'gap-fill', answer: '89' },
      { id: 'l4q4', text: 'Wind turbines require wind speeds of at least _____ km/h to operate efficiently.', type: 'gap-fill', answer: '12' },
      { id: 'l4q5', text: 'Lithium-ion battery capacity degrades by approximately _____% per year.', type: 'gap-fill', answer: '2.5' },
      { id: 'l4q6', text: 'When are solid-state batteries expected to reach commercial production?', type: 'mcq', options: ['2025', '2026', '2028', '2030'], answer: '2028' },
      { id: 'l4q7', text: 'Solid-state batteries could offer _____ to 3 times the energy density of lithium-ion.', type: 'gap-fill', answer: '2' },
      { id: 'l4q8', text: 'What is the only by-product of green hydrogen fuel cells?', type: 'mcq', options: ['Carbon dioxide', 'Nitrogen', 'Water', 'Oxygen'], answer: 'Water' },
      { id: 'l4q9', text: 'The energy transition is expected to create approximately _____ million new jobs by 2050.', type: 'gap-fill', answer: '42' },
      { id: 'l4q10', text: 'How many fossil fuel jobs are projected to be displaced?', type: 'mcq', options: ['5 million', '8 million', '12 million', '18 million'], answer: '12 million' },
    ]
  }
];

// Keep backward compatibility
export const sampleListeningTask = sampleListeningSections[0];

// ======================== SPEAKING ========================
export const sampleSpeakingTask1: SpeakingTask = {
  id: 'seed-s1',
  part: 1,
  prompt: 'Let\'s talk about your hometown. Can you describe the place where you grew up?',
  subPrompts: ['What do you like most about it?', 'Has it changed much over the years?', 'Would you recommend it as a place to visit?']
};

export const sampleSpeakingTask2: SpeakingTask = {
  id: 'seed-s2',
  part: 2,
  prompt: 'Describe a book that you have read and found particularly interesting.',
  subPrompts: ['What was the book about?', 'When did you read it?', 'Why did you find it interesting?', 'Would you recommend it to others?']
};

export const sampleSpeakingTask3: SpeakingTask = {
  id: 'seed-s3',
  part: 3,
  prompt: 'Do you think reading habits have changed in recent years? Why or why not?',
  subPrompts: ['How has technology affected the way people read?', 'Are physical books still important in the digital age?']
};
