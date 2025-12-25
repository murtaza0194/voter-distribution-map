import { GoogleGenAI } from "@google/genai";
import { LocationPoint } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzePopulationDistribution = async (points: LocationPoint[]): Promise<string> => {
  if (points.length === 0) {
    return "لا توجد نقاط لتحليلها. يرجى إضافة بعض النقاط على الخريطة.";
  }

  // Prepare the data prompt
  const dataString = points.map(p => `- المدرسة: ${p.name}, المنطقة: ${p.district || 'غير محدد'}, عدد الناخبين: ${p.count}`).join('\n');

  const prompt = `
    أنت خبير في التخطيط العمراني وتحليل البيانات الانتخابية.
    لديك القائمة التالية لمدارس (مراكز اقتراع) وأعداد الناخبين فيها:
    ${dataString}

    المطلوب:
    1. قدم ملخصاً إحصائياً بسيطاً (المجموع الكلي للناخبين).
    2. حدد المدرسة/المنطقة التي تحتوي على أكبر كثافة/عدد.
    3. قدم استنتاجاً قصيراً أو توصية بناءً على هذا التوزيع.
    
    اكتب الرد باللغة العربية بأسلوب احترافي وواضح.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "لم يتم استلام رد من النموذج.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "حدث خطأ أثناء محاولة تحليل البيانات بواسطة الذكاء الاصطناعي.";
  }
};