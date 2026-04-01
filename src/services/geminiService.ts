import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';
import { sampleWritingTask1, sampleWritingTask2, sampleReadingPassage, sampleReadingPassage2, sampleReadingPassage3, sampleListeningTask, sampleListeningSections, sampleSpeakingTask1, sampleSpeakingTask2, sampleSpeakingTask3 } from '../data/sampleData';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

declare const puter: any;

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean) as string[];

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const geminiClients = GEMINI_KEYS.map(key => new GoogleGenAI({ apiKey: key }));
const openaiClient = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY, dangerouslyAllowBrowser: true }) : null;

const EVAL_MODEL = "gemini-2.0-flash";
const fallbackModel = "gpt-4o-mini";

const SYSTEM_INSTRUCTIONS = `Official System Instruction: IELTS Pro-Evaluator Engine

1. Role & Access Control:
You are the core engine of an IELTS Examination Platform. You must strictly distinguish between Admin Mode and Student Mode.
Admin Mode: Triggered by keywords like "Upload," "Edit," or "Set Question." In this mode, you act as a Content Manager.
Student Mode: Triggered by "Start Test" or "Practice." You are forbidden from showing answer keys or editing tools.

2. Full Training Functionality:
You must support a complete 4-skill mock test: Listening, Reading, Writing, Speaking.

3. Official IELTS Writing Band Descriptors:
- Band 9: Fully addresses all parts of the task. Fully developed position. Seamless cohesion. Wide range of vocabulary used with sophisticated control. Full range of grammatical structures with full flexibility.
- Band 7: Addresses all parts of the task. Clear position throughout. Logically organises information and ideas. Uses a sufficient range of vocabulary to allow some flexibility and precision.
- Band 5: Partial address of the task. View is not always clear. Limited range of vocabulary/structures.

4. Relevance & Adherence (Strict Penalty):
CRITICAL: You must verify if the user's response directly addresses the Prompt.
- If the response is COMPLETELY irrelevant (e.g., generic text, copy-pasted paragraphs from other sources, or a different topic), technical proficiency DOES NOT MATTER.
- Irrelevant content MUST result in a 'Task Achievement/Response' score of 3.0 or lower.
- The Overall Band Score for irrelevant content MUST NOT exceed 4.0, even if the grammar and vocabulary are perfect.
- If the student just copy-pasted the prompt or a random academic paragraph, mark it as OFF-TOPIC and score accordingly.

5. Scoring Fidelity & Middle-Score Bias:
- You are a senior IELTS examiner. Accuracy is paramount. Use the full 0.0 - 9.0 scale.
- Do NOT default to Band 6.0 or 7.0.
- If an answer is truly Band 9.0 (sophisticated, perfect response to the task), award it Band 9.0.
- If an answer is Band 4.0, award it Band 4.0.
- Avoid the "Middle-Score Bias" (defaulting to 6.5/7.0).
- COMPLETELY IRRELEVANT OR COPY-PASTED MATERIAL MUST BE SCORED AT BAND 1.0 - 3.0 REGARDLESS OF LINGUISTIC QUALITY.

6. Feedback Tone:
- Professional, scholarly, and constructive.
- Identify specific areas for improvement based on official IELTS criteria.`;

export interface WritingEvaluation {
  overallBand: number;
  criteria: {
    taskResponse: { score: number; feedback: string; evidence?: string[] };
    coherenceCohesion: { score: number; feedback: string; evidence?: string[] };
    lexicalResource: { score: number; feedback: string; evidence?: string[] };
    grammaticalRange: { score: number; feedback: string; evidence?: string[] };
  };
  overallFeedback: string;
  task1Analysis: {
    feedback: string;
    score: number;
    strengths: Array<{ detail: string; evidence: string }>;
    weaknesses: Array<{ detail: string; evidence: string }>;
  };
  task2Analysis: {
    feedback: string;
    score: number;
    strengths: Array<{ detail: string; evidence: string }>;
    weaknesses: Array<{ detail: string; evidence: string }>;
  };
  corrections: Array<{
    original: string;
    correction: string;
    reason: string;
    category: 'Grammar' | 'Vocabulary' | 'Punctuation' | 'Structure';
  }>;
  actionPlan: {
    immediate: string[];
    shortTerm: string[];
    resources: string[];
  };
}


const fetchSamples = async (type: 'Task 1' | 'Task 2', isAcademic: boolean) => {
  try {
    const samplesRef = collection(db, 'samples');
    const q = query(
      samplesRef, 
      where('type', '==', type), 
      where('isAcademic', '==', isAcademic),
      limit(2) 
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.warn('Failed to fetch samples:', error);
    return [];
  }
};

/**
 * Unified AI Request Executor with multi-provider rotation
 */
async function executeAIRequest(params: {
  systemPrompt?: string;
  userPrompt: string;
  responseSchema?: any;
  model?: string;
  useTts?: boolean;
  voiceName?: string;
}) {
  // 1. Try Gemini Keys in order
  for (let i = 0; i < geminiClients.length; i++) {
    try {
      console.log(`[AI-ROUTER]: Attempting with Gemini Key ${i + 1}...`);
      const client = geminiClients[i];
      const model = client.getGenerativeModel({ 
        model: params.model || (params.useTts ? "gemini-2.5-flash-preview-tts" : EVAL_MODEL) 
      });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: (params.systemPrompt ? params.systemPrompt + "\n\n" : "") + params.userPrompt }] }],
        generationConfig: params.responseSchema ? {
          responseMimeType: "application/json",
          responseSchema: params.responseSchema
        } : (params.useTts ? { 
          responseModalities: ["AUDIO"] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: params.voiceName || 'Zephyr' }
            }
          }
        } : undefined)
      });
      
      return result.response;
    } catch (error: any) {
      console.warn(`Gemini Key ${i + 1} failed:`, error.message);
      if (i === geminiClients.length - 1) break; // Last key failed
    }
  }

  // 2. Try OpenAI
  if (openaiClient) {
    try {
      console.log(`[AI-ROUTER]: All Gemini keys failed. Switching to OpenAI...`);
      const response = await openaiClient.chat.completions.create({
        model: fallbackModel,
        messages: [
          { role: "system", content: params.systemPrompt || "You are a helpful assistant." },
          { role: "user", content: params.userPrompt }
        ],
        response_format: params.responseSchema ? { type: "json_object" } : undefined
      });
      
      const content = response.choices[0].message.content;
      return {
        text: content,
        audioContents: [] 
      } as any;
    } catch (error: any) {
      console.warn("OpenAI fallback failed:", error.message);
    }
  }

  // 3. Try Puter.js (Final AI Fallback)
  if (typeof puter !== 'undefined') {
    try {
      const isSignedIn = puter.auth ? puter.auth.isSignedIn() : false;
      if (isSignedIn) {
        console.log(`[AI-ROUTER]: OpenAI failed. Switching to Puter.js...`);
        const systemMsg = params.systemPrompt ? `SYSTEM INSTRUCTION: ${params.systemPrompt}\n\n` : "";
        const puterPrompt = `${systemMsg}${params.userPrompt}${params.responseSchema ? "\n\nCRITICAL: You MUST return ONLY a valid JSON object matching the requested schema." : ""}`;
        
        const response = await puter.ai.chat(puterPrompt);
        return {
          text: response.toString(),
          audioContents: []
        } as any;
      } else {
        console.log(`[AI-ROUTER]: Puter.js skipped because user is not signed in to Puter.`);
      }
    } catch (error: any) {
      console.warn("Puter.js fallback failed:", error.message);
    }
  }

  throw new Error("All AI providers exhausted.");
}

export const evaluateWriting = async (tasks: Array<{ prompt: string, content: string, type: number }>, isAcademic: boolean = true): Promise<WritingEvaluation> => {
  try {
    const samples1 = await fetchSamples('Task 1', isAcademic);
    const samples2 = await fetchSamples('Task 2', isAcademic);

    const userPrompt = `
      Evaluate the following IELTS ${isAcademic ? 'Academic' : 'General Training'} Writing submission(s). 
      Provide a combined overall band score and detailed separate feedback/analysis for Task 1 and Task 2.
      
      FEW-SHOT EXAMPLES (REFERENCE):
      ${samples1.map(s => `[Task 1 Sample - Band ${s.score}]: ${s.content}`).join('\n')}
      ${samples2.map(s => `[Task 2 Sample - Band ${s.score}]: ${s.content}`).join('\n')}

      SCORING DIRECTIVE (NIL-BIAS): 
      1. CRITICAL: Check for prompt relevance. If the student has copy-pasted irrelevant academic paragraphs, or is talking about a different topic, or provided a generic response that doesn't target the prompt, you MUST cap the Overall Band at 3.0 and Task Achievement at 2.0.
      2. EVIDENCE REQUIREMENT: For every strength, weakness, and criteria feedback, you MUST quote the specific part of the student submission that justifies your point.
      3. Action Plan: Provide 3 concrete, actionable steps the student can take to improve their score.
      4. Do NOT default to middle scores (6.0-7.0). If the response is excellent/native-level, award Band 9.0.
      
      ${tasks.map((t, i) => `Task ${t.type} Prompt: ${t.prompt}\nTask ${t.type} Submission: ${t.content}\n\n`).join('')}`;

    const response = await executeAIRequest({
      systemPrompt: SYSTEM_INSTRUCTIONS,
      userPrompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallBand: { type: Type.NUMBER },
          criteria: {
            type: Type.OBJECT,
            properties: {
              taskResponse: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              coherenceCohesion: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              lexicalResource: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              grammaticalRange: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
            },
            required: ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRange"],
          },
          overallFeedback: { type: Type.STRING },
          task1Analysis: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              score: { type: Type.NUMBER },
              strengths: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { detail: { type: Type.STRING }, evidence: { type: Type.STRING } } 
                } 
              },
              weaknesses: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { detail: { type: Type.STRING }, evidence: { type: Type.STRING } } 
                } 
              },
            },
            required: ["feedback", "score", "strengths", "weaknesses"],
          },
          task2Analysis: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              score: { type: Type.NUMBER },
              strengths: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { detail: { type: Type.STRING }, evidence: { type: Type.STRING } } 
                } 
              },
              weaknesses: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { detail: { type: Type.STRING }, evidence: { type: Type.STRING } } 
                } 
              },
            },
            required: ["feedback", "score", "strengths", "weaknesses"],
          },
          corrections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING },
                reason: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['Grammar', 'Vocabulary', 'Punctuation', 'Structure'] },
              },
              required: ["original", "correction", "reason", "category"],
            },
          },
          actionPlan: { 
            type: Type.OBJECT,
            properties: {
              immediate: { type: Type.ARRAY, items: { type: Type.STRING } },
              shortTerm: { type: Type.ARRAY, items: { type: Type.STRING } },
              resources: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["immediate", "shortTerm", "resources"],
          },
        },
        required: ["overallBand", "criteria", "overallFeedback", "task1Analysis", "task2Analysis", "corrections", "actionPlan"],
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.warn('Gemini API failed for Writing evaluation, using local scoring:', error);
    // Estimate score based on word count and basic heuristics
    const totalWords = tasks.reduce((sum, t) => sum + (t.content?.split(/\s+/).length || 0), 0);
    const estimatedBand = Math.min(7.0, Math.max(4.0, 4.0 + (totalWords / 500) * 2));
    const roundedBand = Math.round(estimatedBand * 2) / 2;
    return {
      overallBand: roundedBand,
      criteria: { 
        taskResponse: { score: roundedBand, feedback: 'Scored locally' }, 
        coherenceCohesion: { score: roundedBand, feedback: 'Scored locally' }, 
        lexicalResource: { score: roundedBand, feedback: 'Scored locally' }, 
        grammaticalRange: { score: roundedBand, feedback: 'Scored locally' } 
      },
      overallFeedback: `Your writing has been scored locally (AI evaluation unavailable). Based on your word count (${totalWords} words), your estimated band is ${roundedBand}. Please retry later for detailed AI feedback.`,
      task1Analysis: { 
        feedback: 'AI feedback unavailable. Try again when API quota resets.', 
        score: roundedBand, 
        strengths: [{ detail: 'Submission completed', evidence: '' }], 
        weaknesses: [{ detail: 'Could not evaluate in detail', evidence: '' }] 
      },
      task2Analysis: { 
        feedback: 'AI feedback unavailable. Try again when API quota resets.', 
        score: roundedBand, 
        strengths: [{ detail: 'Submission completed', evidence: '' }], 
        weaknesses: [{ detail: 'Could not evaluate in detail', evidence: '' }] 
      },
      corrections: [],
      actionPlan: {
        immediate: ["Review task requirements", "Focus on word count"],
        shortTerm: ["Practice daily writing", "Expand vocabulary"],
        resources: ["IELTS Writing Guide", "Common Grammar Mistakes"]
      },
    };
  }
};

export interface ReadingListeningEvaluation {
  score: number;
  bandScore: number;
  feedback: string;
}

const getIELTSBandFromScore = (score: number, type: 'Reading' | 'Listening', isAcademic: boolean = true) => {
  if (type === 'Listening') {
    if (score >= 39) return 9.0;
    if (score >= 37) return 8.5;
    if (score >= 35) return 8.0;
    if (score >= 32) return 7.5;
    if (score >= 30) return 7.0;
    if (score >= 27) return 6.5;
    if (score >= 23) return 6.0;
    if (score >= 19) return 5.5;
    if (score >= 16) return 5.0;
    if (score >= 13) return 4.5;
    if (score >= 10) return 4.0;
    if (score >= 7) return 3.5;
    if (score >= 5) return 3.0;
    if (score >= 4) return 2.5;
    if (score >= 3) return 2.0;
    if (score >= 1) return 1.0;
    return 0;
  }

  if (isAcademic) {
    // Reading Academic
    if (score >= 39) return 9.0;
    if (score >= 37) return 8.5;
    if (score >= 35) return 8.0;
    if (score >= 33) return 7.5;
    if (score >= 30) return 7.0;
    if (score >= 27) return 6.5;
    if (score >= 23) return 6.0;
    if (score >= 19) return 5.5;
    if (score >= 15) return 5.0;
    if (score >= 13) return 4.5;
    if (score >= 10) return 4.0;
    if (score >= 7) return 3.5;
    if (score >= 5) return 3.0;
    if (score >= 4) return 2.5;
    if (score >= 3) return 2.0;
    if (score >= 1) return 1.0;
    return 0;
  } else {
    // Reading General Training
    if (score >= 40) return 9.0;
    if (score >= 39) return 8.5;
    if (score >= 37) return 8.0;
    if (score >= 36) return 7.5;
    if (score >= 34) return 7.0;
    if (score >= 32) return 6.5;
    if (score >= 30) return 6.0;
    if (score >= 27) return 5.5;
    if (score >= 23) return 5.0;
    if (score >= 19) return 4.5;
    if (score >= 15) return 4.0;
    if (score >= 12) return 3.5;
    if (score >= 9) return 3.0;
    if (score >= 6) return 2.5;
    if (score >= 3) return 2.0;
    if (score >= 1) return 1.0;
    return 0;
  }
};

export const evaluateReadingListening = async (
  type: 'Reading' | 'Listening',
  answers: Record<string, string>,
  correctAnswers: Record<string, string>,
  totalQuestions: number = 40,
  isAcademic: boolean = true
): Promise<ReadingListeningEvaluation> => {
  let correctCount = 0;
  Object.keys(correctAnswers).forEach(key => {
    const userAnswer = answers[key]?.toLowerCase().trim() || "";
    const correctAnswer = correctAnswers[key].toLowerCase().trim();
    if (userAnswer === correctAnswer) {
      correctCount++;
    }
  });

  // Scale to 40 if the test was shorter (e.g. 5 questions in quick practice)
  const scaledScore = totalQuestions === 40 ? correctCount : Math.round((correctCount / totalQuestions) * 40);
  const bandScore = getIELTSBandFromScore(scaledScore, type, isAcademic);

  // Try to get AI feedback, fall back to local feedback
  let feedback = '';
  try {
    const response = await executeAIRequest({
      systemPrompt: SYSTEM_INSTRUCTIONS,
      userPrompt: `
      The student scored ${correctCount}/${totalQuestions} in an IELTS ${type} test. 
      This scales to approximately ${scaledScore}/40 marks.
      
      Provide a detailed, encouraging feedback note (max 150 words). 
      Break it down into:
      1. Overall Performance
      2. Specific Areas for Improvement (based on the score)
      3. Actionable Advice for the next session.
      
      CRITICAL: Do not use rubric descriptors for ${type}. Focus ONLY on the accuracy of answers.`
    });
    feedback = response.text || '';
  } catch (error) {
    console.warn('AI failed for Reading/Listening feedback:', error);
  }

  if (!feedback) {
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    if (bandScore >= 7) {
      feedback = `Excellent performance! You scored ${correctCount}/${totalQuestions} (${percentage}%), achieving Band ${bandScore}. Your comprehension skills are strong. Focus on the few questions you missed to push towards an even higher band. Practice with timed tests to build consistency.`;
    } else if (bandScore >= 6) {
      feedback = `Good effort! You scored ${correctCount}/${totalQuestions} (${percentage}%), achieving Band ${bandScore}. You demonstrate solid ${type.toLowerCase()} skills. To improve, focus on scanning techniques for detail questions and practice with more challenging passages. Regular timed practice will help improve both speed and accuracy.`;
    } else if (bandScore >= 5) {
      feedback = `You scored ${correctCount}/${totalQuestions} (${percentage}%), achieving Band ${bandScore}. You have a foundation to build on. Focus on vocabulary building, practice skimming and scanning techniques, and work through practice tests regularly. Pay attention to keywords in questions to locate answers more efficiently.`;
    } else {
      feedback = `You scored ${correctCount}/${totalQuestions} (${percentage}%), achieving Band ${bandScore}. Don't be discouraged — improvement comes with practice! Start by reading simpler texts and gradually increase difficulty. Focus on understanding main ideas before tackling detail questions. Daily reading practice will help build your skills.`;
    }
  }

  return {
    score: correctCount,
    bandScore,
    feedback,
  };
};

export interface FullReadingTest {
  passages: ReadingPassage[];
}

export const generateFullReadingTest = async (isAcademic: boolean = true): Promise<FullReadingTest> => {
  const passages = await Promise.all([
    generateReadingPassage(true, isAcademic),
    generateReadingPassage(true, isAcademic),
    generateReadingPassage(true, isAcademic)
  ]);
  return { passages };
};

export interface FullListeningTest {
  sections: ListeningTask[];
}

export const generateFullListeningTest = async (): Promise<FullListeningTest> => {
  try {
    const sections = await Promise.all([
      generateListeningTask(1, true),
      generateListeningTask(2, true),
      generateListeningTask(3, true),
      generateListeningTask(4, true)
    ]);
    return { sections };
  } catch (error) {
    console.warn('Gemini API failed for full listening test, using sample data:', error);
    return { sections: sampleListeningSections.map(s => ({ ...s })) };
  }
};

export interface SpeakingEvaluation {
  overallBand: number;
  criteria: {
    fluencyCoherence: { score: number; feedback: string; evidence?: string[] };
    lexicalResource: { score: number; feedback: string; evidence?: string[] };
    grammaticalRange: { score: number; feedback: string; evidence?: string[] };
    pronunciation: { score: number; feedback: string; evidence?: string[] };
  };
  feedback: string;
  actionPlan: string[];
}

export interface WritingTask {
  id: string;
  type: 1 | 2;
  prompt: string;
  data?: any; // For Task 1 charts
  imageUrl?: string;
}

export const generateWritingTask = async (type: 1 | 2, isAcademic: boolean = true): Promise<WritingTask> => {
  try {
    const topics = [
      "Environment", "Technology", "Education", "Globalization", "Health", 
      "Architecture", "Economics", "Culture", "Science", "Space Exploration",
      "Social Media", "Urbanization", "Work-life Balance", "Tourism", "History"
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const seed = Math.floor(Math.random() * 1000000);

    const response = await executeAIRequest({
      model: "gemini-1.5-flash",
      userPrompt: `Generate a unique and challenging IELTS ${isAcademic ? 'Academic' : 'General Training'} Writing Task ${type} prompt. 
      Topic area: ${randomTopic}. 
      ${type === 1 ? (isAcademic ? 'Include a data structure for a chart (e.g., line chart, bar chart, pie chart, or table) with 5-8 data points.' : 'Include a letter writing scenario (e.g., formal, semi-formal, or informal).') : 'Include an argumentative essay topic.'}
      Ensure the prompt is different from common ones.
      Seed for randomness: ${seed}.
      Return the response in JSON format.`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
          data: { 
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.NUMBER },
                category: { type: Type.STRING }
              }
            }
          }
        },
        required: ["prompt"]
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      id: Date.now().toString(),
      type,
      prompt: data.prompt,
      data: data.data
    };
  } catch (error) {
    console.warn(`AI failed for Writing Task ${type}, using sample data:`, error);
    return type === 1 ? { ...sampleWritingTask1 } : { ...sampleWritingTask2 };
  }
};

export interface ReadingPassage {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  questions: Array<{
    id: string;
    text: string;
    options?: string[];
    answer: string;
    type: 'mcq' | 'matching' | 'gap-fill';
  }>;
}

let readingPassageIdx = 0;
const sampleReadingPassages = [sampleReadingPassage, sampleReadingPassage2, sampleReadingPassage3];

export const generateReadingPassage = async (isFullTest: boolean = false, isAcademic: boolean = true): Promise<ReadingPassage> => {
  const getFallback = () => {
    const passage = { ...sampleReadingPassages[readingPassageIdx % sampleReadingPassages.length] };
    readingPassageIdx++;
    return passage;
  };

  try {
    const questionCount = isFullTest ? 13 : 5;
    const response = await executeAIRequest({
      userPrompt: `Generate an IELTS ${isAcademic ? 'Academic' : 'General Training'} Reading passage (approx ${isFullTest ? '800' : '400'} words) on a random topic. 
      ${isAcademic ? 'The topic should be academic in nature.' : 'The topic should be related to everyday life or work-related contexts.'}
      Include ${questionCount} questions of various types (MCQ, Matching, Gap-fill).
      Return the response in JSON format.`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['mcq', 'matching', 'gap-fill'] }
              },
              required: ["id", "text", "answer", "type"]
            }
          }
        },
        required: ["title", "content", "questions"]
      }
    });

    const data = JSON.parse(response.text || "{}");
    return { id: Date.now().toString(), ...data };
  } catch (error) {
    console.warn('AI failed for Reading, using sample data:', error);
    return getFallback();
  }
};

export interface SpeakingTask {
  id: string;
  part: 1 | 2 | 3;
  prompt: string;
  subPrompts?: string[];
  imageUrl?: string;
}

const sampleSpeakingTasks: Record<number, SpeakingTask> = { 1: sampleSpeakingTask1, 2: sampleSpeakingTask2, 3: sampleSpeakingTask3 };

export const generateSpeakingTask = async (part: 1 | 2 | 3): Promise<SpeakingTask> => {
  try {
    const response = await executeAIRequest({
      model: "gemini-1.5-flash",
      userPrompt: `Generate an IELTS Speaking Part ${part} task. 
      If Part 2, include sub-prompts for the cue card.
      Return the response in JSON format.`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
          subPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["prompt"]
      }
    });

    const data = JSON.parse(response.text || "{}");
    return { id: Date.now().toString(), part, prompt: data.prompt, subPrompts: data.subPrompts };
  } catch (error) {
    console.warn(`AI failed for Speaking Part ${part}, using sample data:`, error);
    return { ...sampleSpeakingTasks[part] };
  }
};

export const evaluateSpeaking = async (part: number, prompt: string, transcript: string, isAcademic: boolean = true): Promise<SpeakingEvaluation> => {
  try {
    const response = await executeAIRequest({
      model: "gemini-1.5-flash",
      systemPrompt: SYSTEM_INSTRUCTIONS,
      userPrompt: `Evaluate the following IELTS ${isAcademic ? 'Academic' : 'General Training'} Speaking Part ${part} transcript.
      Prompt: ${prompt}
      Transcript: ${transcript}
      
      SCORING DIRECTIVE (NIL-BIAS): 
      1. CRITICAL: Check for relevance. If the student talks about a completely different topic or is reading irrelevant text, the Overall Band and Fluency & Coherence MUST NOT exceed 4.0.
      2. Use the full IELTS Speaking rubric. Do NOT default to middle scores. 
      3. High-quality responses that expertly address the prompt must be awarded a high band (8.0-9.0).`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallBand: { type: Type.NUMBER },
          criteria: {
            type: Type.OBJECT,
            properties: {
              fluencyCoherence: { type: Type.NUMBER },
              lexicalResource: { type: Type.NUMBER },
              grammaticalRange: { type: Type.NUMBER },
              pronunciation: { type: Type.NUMBER },
            },
            required: ["fluencyCoherence", "lexicalResource", "grammaticalRange", "pronunciation"],
          },
          feedback: { type: Type.STRING },
        },
        required: ["overallBand", "criteria", "feedback"],
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.warn('Gemini API failed for Speaking evaluation, using local scoring:', error);
    const wordCount = transcript?.split(/\s+/).length || 0;
    const estimatedBand = Math.min(7.0, Math.max(4.0, 4.0 + (wordCount / 150) * 2));
    const roundedBand = Math.round(estimatedBand * 2) / 2;
    return {
      overallBand: roundedBand,
      criteria: { 
        fluencyCoherence: { score: roundedBand, feedback: 'Scored locally' }, 
        lexicalResource: { score: roundedBand, feedback: 'Scored locally' }, 
        grammaticalRange: { score: roundedBand, feedback: 'Scored locally' }, 
        pronunciation: { score: roundedBand, feedback: 'Scored locally' } 
      },
      feedback: `Your speaking has been scored locally (AI evaluation unavailable). Based on your response length (${wordCount} words), your estimated band is ${roundedBand}. Please retry later for detailed AI feedback.`,
      actionPlan: ["Practice speaking for longer durations", "Focus on clear pronunciation", "Work on fluency"]
    };
  }
};

export const generateFullSpeakingTest = async (): Promise<SpeakingTask[]> => {
  const parts: (1 | 2 | 3)[] = [1, 2, 3];
  return Promise.all(parts.map(part => generateSpeakingTask(part)));
};

export const evaluateFullSpeaking = async (responses: { part: number, prompt: string, transcript: string }[], isAcademic: boolean = true): Promise<SpeakingEvaluation> => {
  try {
    const response = await executeAIRequest({
      model: "gemini-1.5-flash",
      systemPrompt: SYSTEM_INSTRUCTIONS,
      userPrompt: `Evaluate the following full IELTS ${isAcademic ? 'Academic' : 'General Training'} Speaking test (Parts 1, 2, and 3).
      
      ${responses.map(r => `Part ${r.part}:
      Prompt: ${r.prompt}
      Transcript: ${r.transcript}`).join('\n\n')}
      
      SCORING DIRECTIVE: 
      1. Check for relevance across all parts. If the student is talking about something COMPLETELY unrelated to the prompts, cap Fluency & Coherence and Overall Band at 4.0.
      2. EVIDENCE REQUIREMENT: For feedback, you must quote parts of the transcript to support your evaluation.
      3. If relevant, use the full IELTS Speaking rubric to provide an accurate score.
      4. High-quality responses that expertly address the prompts must be awarded a high band (8.0-9.0).
      5. Action Plan: Provide 3 concrete steps for improvement.
      
      Provide a comprehensive evaluation across all parts.`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallBand: { type: Type.NUMBER },
          criteria: {
            type: Type.OBJECT,
            properties: {
              fluencyCoherence: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              lexicalResource: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              grammaticalRange: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
              pronunciation: { 
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } }
              },
            },
            required: ["fluencyCoherence", "lexicalResource", "grammaticalRange", "pronunciation"],
          },
          feedback: { type: Type.STRING },
          actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["overallBand", "criteria", "feedback", "actionPlan"],
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.warn('Gemini API failed for full Speaking evaluation, using local scoring:', error);
    const totalWords = responses.reduce((sum, r) => sum + (r.transcript?.split(/\s+/).length || 0), 0);
    const estimatedBand = Math.min(7.0, Math.max(4.0, 4.0 + (totalWords / 300) * 2));
    const roundedBand = Math.round(estimatedBand * 2) / 2;
    return {
      overallBand: roundedBand,
      criteria: { 
        fluencyCoherence: { score: roundedBand, feedback: 'Scored locally' }, 
        lexicalResource: { score: roundedBand, feedback: 'Scored locally' }, 
        grammaticalRange: { score: roundedBand, feedback: 'Scored locally' }, 
        pronunciation: { score: roundedBand, feedback: 'Scored locally' } 
      },
      feedback: `Your speaking test has been scored locally (AI evaluation unavailable). Based on total response length (${totalWords} words across ${responses.length} parts), your estimated band is ${roundedBand}. Please retry later for detailed AI feedback.`,
      actionPlan: ["Practice speaking for longer durations", "Use more varied vocabulary", "Focus on clear pronunciation"]
    };
  }
};

function addWavHeader(base64Pcm: string, sampleRate: number = 24000): string {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, len, true);

  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, binaryString.charCodeAt(i));
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export const generateAudio = async (text: string, voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Zephyr'): Promise<string> => {
  try {
    const response = await executeAIRequest({
      model: "gemini-2.5-flash-preview-tts",
      userPrompt: text,
      useTts: true,
      voiceName
    });

    const audioContent = response.audioContents?.[0];
    if (!audioContent) throw new Error("No audio content in response");

    const audioBase64 = audioContent.data;
    return `data:audio/mp3;base64,${audioBase64}`;
  } catch (error) {
    console.error('Audio generation failed, using browser TTS fallback:', error);
    // Fallback: use browser's built-in SpeechSynthesis to create audio
    return new Promise<string>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Neither Gemini TTS nor browser speech synthesis is available'));
        return;
      }
      // Use the browser's speech synthesis for playback
      // We create a special URL that the audio player will handle
      resolve('browser-tts://' + encodeURIComponent(text));
    });
  }
};

export interface ListeningTask {
  id: string;
  section: number;
  title: string;
  transcript: string;
  prompt?: string; // Fallback for admin content
  audioUrl?: string;
  imageUrl?: string;
  questions: Array<{
    id: string;
    text: string;
    type: 'gap-fill' | 'mcq';
    options?: string[];
    answer: string;
  }>;
}

export const generateListeningTask = async (section: number, isFullTest: boolean = false): Promise<ListeningTask> => {
  try {
    const questionCount = isFullTest ? 10 : 5;
    const response = await executeAIRequest({
      model: "gemini-1.5-flash",
      userPrompt: `Generate an IELTS Listening Section ${section} task. 
      Include a title, a full transcript for the audio, and ${questionCount} questions (mix of gap-fill and MCQ).
      For gap-fill, use "_____" in the question text.
      Return the response in JSON format.`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          transcript: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['gap-fill', 'mcq'] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING }
              },
              required: ["id", "text", "type", "answer"]
            }
          }
        },
        required: ["title", "transcript", "questions"]
      }
    });

    const data = JSON.parse(response.text || "{}");
    return { id: Date.now().toString(), section, ...data };
  } catch (error) {
    console.warn(`AI failed for Listening Section ${section}, using sample data:`, error);
    const fallback = sampleListeningSections[section - 1] || sampleListeningSections[0];
    return { ...fallback, id: Date.now().toString() + section };
  }
};
