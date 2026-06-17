import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../common/feature-flags.service';
import type { JobDescriptionSuggestionsDto } from './dto/description-suggestions.dto';

export interface JobDescriptionSuggestion {
  topic: string;
  prompt: string;
}

export interface JobDescriptionSuggestionsResult {
  suggestions: JobDescriptionSuggestion[];
}

interface HeuristicRule {
  match: RegExp;
  suggestions: JobDescriptionSuggestion[];
}

const HEURISTIC_RULES: HeuristicRule[] = [
  {
    match: /water heater|hot water heater|tankless/i,
    suggestions: [
      {
        topic: 'Water heater size',
        prompt: 'What size water heater do you need (e.g. 40 or 50 gallon)?',
      },
      {
        topic: 'Fuel type',
        prompt: 'Is the water heater gas or electric?',
      },
      {
        topic: 'Old unit removal',
        prompt: 'Does the old water heater need to be removed and hauled away?',
      },
      {
        topic: 'Location',
        prompt: 'Where is the water heater located (basement, garage, closet)?',
      },
    ],
  },
  {
    match: /gravel|crushed stone|pea gravel|river rock|aggregate/i,
    suggestions: [
      {
        topic: 'Gravel type',
        prompt: 'What type of gravel do you want (e.g. pea gravel, #57 stone, crushed limestone)?',
      },
      {
        topic: 'Quantity',
        prompt: 'Roughly how much gravel do you need (tons, cubic yards, or truckloads)?',
      },
      {
        topic: 'Delivery access',
        prompt: 'Are there access constraints for delivery (narrow driveway, low gate, steep grade)?',
      },
      {
        topic: 'Placement',
        prompt: 'Where should the gravel be dumped or spread on your property?',
      },
    ],
  },
  {
    match:
      /\bpalm\b|palm tree|tree install|plant(?:ing)?\s+(?:\d+\s+)?(?:tree|trees|palm|palms|shrub|shrubs)|install\s+\d+\s+(?:tree|trees|palm|palms)|(?:tree|trees|shrub|shrubs)\s+to\s+plant/i,
    suggestions: [
      {
        topic: 'Tree supply',
        prompt: 'Do you already have the trees/plants, or should the contractor source them?',
      },
      {
        topic: 'Species & size',
        prompt: 'What species or mature height are the trees (e.g. queen palm, 10 ft)?',
      },
      {
        topic: 'Planting locations',
        prompt: 'Where on the property should each tree be planted (front yard, pool area, etc.)?',
      },
      {
        topic: 'Site access',
        prompt: 'Can trucks or equipment reach the planting spots (gate width, side yard, slopes)?',
      },
      {
        topic: 'Ground prep',
        prompt: 'Is any stump removal, rock removal, or irrigation work needed before planting?',
      },
    ],
  },
  {
    match: /sod|lawn install|seed lawn|mulch|landscape install|landscaping|plant bed|hardscape|retaining wall/i,
    suggestions: [
      {
        topic: 'Area size',
        prompt: 'Roughly how large is the area (square footage or dimensions)?',
      },
      {
        topic: 'Materials',
        prompt: 'Do you already have materials, or should the contractor supply them?',
      },
      {
        topic: 'Site access',
        prompt: 'Are there access limits for equipment or deliveries (narrow gate, backyard only)?',
      },
      {
        topic: 'Existing conditions',
        prompt: 'What is there now (grass, weeds, old plants) and should it be removed first?',
      },
    ],
  },
  {
    match: /roof|shingle|re-?roof/i,
    suggestions: [
      {
        topic: 'Roof size',
        prompt: 'Roughly how large is the roof (square footage or number of stories)?',
      },
      {
        topic: 'Material',
        prompt: 'What roofing material do you want (asphalt shingles, metal, etc.)?',
      },
      {
        topic: 'Tear-off',
        prompt: 'Should the existing shingles be removed, or can new ones go over them?',
      },
    ],
  },
  {
    match: /fence|fencing/i,
    suggestions: [
      {
        topic: 'Fence length',
        prompt: 'How many linear feet of fencing do you need?',
      },
      {
        topic: 'Material & style',
        prompt: 'What fence material and style do you want (wood privacy, chain link, vinyl)?',
      },
      {
        topic: 'Gates',
        prompt: 'Do you need any gates, and how wide should they be?',
      },
    ],
  },
  {
    match: /dump|haul|junk removal|debris|cleanout/i,
    suggestions: [
      {
        topic: 'Volume',
        prompt: 'About how much needs to be removed (items, bags, truckloads, or room size)?',
      },
      {
        topic: 'Access',
        prompt: 'Are there stairs, tight hallways, or parking limits for loading?',
      },
      {
        topic: 'Materials',
        prompt: 'What types of items or debris need to be hauled away?',
      },
    ],
  },
];

@Injectable()
export class JobDescriptionAiService {
  private readonly logger = new Logger(JobDescriptionAiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async suggest(
    dto: JobDescriptionSuggestionsDto,
  ): Promise<JobDescriptionSuggestionsResult> {
    if (!this.flags.flags.aiJobDescriptionEnabled) {
      throw new ServiceUnavailableException('Job description suggestions are disabled.');
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (apiKey) {
      try {
        return await this.suggestWithGemini(dto, apiKey);
      } catch (err) {
        this.logger.warn(
          `Gemini suggestion failed, using heuristics: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { suggestions: this.suggestWithHeuristics(dto) };
  }

  private suggestWithHeuristics(
    dto: JobDescriptionSuggestionsDto,
  ): JobDescriptionSuggestion[] {
    const haystack = `${dto.title}\n${dto.description}`.toLowerCase();
    const seen = new Set<string>();
    const out: JobDescriptionSuggestion[] = [];

    for (const rule of HEURISTIC_RULES) {
      if (!rule.match.test(haystack)) continue;

      for (const suggestion of rule.suggestions) {
        const topicKey = suggestion.topic.toLowerCase();
        if (seen.has(topicKey)) continue;
        if (this.suggestionAlreadyCovered(suggestion, haystack)) continue;

        seen.add(topicKey);
        out.push(suggestion);
      }
    }

    if (out.length === 0 && dto.description.trim().length < 24) {
      out.push(...this.genericSuggestions(dto.workType));
    }

    return out.slice(0, 5);
  }

  private suggestionAlreadyCovered(
    suggestion: JobDescriptionSuggestion,
    haystack: string,
  ): boolean {
    const topic = suggestion.topic.toLowerCase();
    const prompt = suggestion.prompt.toLowerCase();

    if (topic.includes('fuel') || prompt.includes('gas or electric')) {
      return /\bgas\b|\belectric\b|\bpropane\b/.test(haystack);
    }

    if (topic.includes('water heater size') || (topic.includes('size') && prompt.includes('gallon'))) {
      return /\b\d+\s*(-?\s*)?(gallon|gal)\b/.test(haystack);
    }

    if (topic.includes('removal') || topic.includes('haul') || topic.includes('tear-off')) {
      return /remove|haul|disposal|tear[\s-]?off|haul[\s-]?away/.test(haystack);
    }

    if (topic.includes('gravel type') || prompt.includes('type of gravel')) {
      return /pea gravel|crushed|river rock|#57|limestone|aggregate type/.test(haystack);
    }

    if (topic.includes('quantity') || prompt.includes('how much')) {
      return /\b\d+\s*(ton|tons|yard|yards|load|loads|cubic|sq\.?\s*ft|square feet|linear feet|ft)\b/.test(
        haystack,
      );
    }

    if (topic.includes('delivery access') || topic.includes('site access') || topic.includes('access')) {
      return /narrow|driveway|gate|access|side yard|backyard only|steep|slope|stairs|equipment reach/.test(
        haystack,
      );
    }

    if (topic.includes('tree supply') || prompt.includes('already have')) {
      return /already have|i have|purchased|delivered|contractor (source|supply|provide)|you supply/.test(
        haystack,
      );
    }

    if (topic.includes('species') || (topic.includes('size') && prompt.includes('species'))) {
      return /queen palm|sabal|adonidia|foxtail|mature height|\b\d+\s*(ft|foot|feet|')\b|container size|pot size|species/.test(
        haystack,
      );
    }

    if (topic.includes('planting location') || prompt.includes('where on the property')) {
      return /front yard|backyard|back yard|side yard|pool area|near (the )?driveway|along (the )?fence|planting (spot|location|site)/.test(
        haystack,
      );
    }

    if (topic.includes('ground prep') || topic.includes('existing conditions')) {
      return /stump|irrigation|soil prep|weed|remove existing|rock removal|grade|level/.test(haystack);
    }

    if (topic.includes('material') && !topic.includes('fuel')) {
      return /asphalt|metal roof|shingle type|vinyl|chain link|wood privacy|supply materials|materials included/.test(
        haystack,
      );
    }

    if (topic.includes('fence length')) {
      return /\b\d+\s*(linear feet|ft|foot|feet)\b/.test(haystack);
    }

    return false;
  }

  private genericSuggestions(workType: string): JobDescriptionSuggestion[] {
    const byType: Record<string, JobDescriptionSuggestion[]> = {
      plumbing: [
        {
          topic: 'Scope',
          prompt: 'What exactly needs to be repaired or installed, and where in the home?',
        },
        {
          topic: 'Access',
          prompt: 'Will the contractor need to access a crawl space, attic, or shut off water?',
        },
      ],
      electrical: [
        {
          topic: 'Scope',
          prompt: 'What electrical work is needed (outlets, panel, lighting, new circuit)?',
        },
        {
          topic: 'Permits',
          prompt: 'Do you know if a permit is required for this work in your area?',
        },
      ],
      landscaping: [
        {
          topic: 'Scope',
          prompt: 'What landscaping work do you need (planting, sod, mulch, beds, hardscape)?',
        },
        {
          topic: 'Area & access',
          prompt: 'How large is the work area, and can equipment reach it easily?',
        },
      ],
      hauling: [
        {
          topic: 'Items',
          prompt: 'What needs to be picked up or delivered, and about how much?',
        },
        {
          topic: 'Access',
          prompt: 'Are there stairs, tight turns, or parking limits at pickup or drop-off?',
        },
      ],
    };

    return (
      byType[workType] ?? [
        {
          topic: 'Scope',
          prompt: 'What specific work should be completed, and what should the finished result look like?',
        },
        {
          topic: 'Materials',
          prompt: 'Will you supply materials, or should the contractor provide them?',
        },
        {
          topic: 'Access & timing',
          prompt: 'Are there access restrictions or preferred hours for the work?',
        },
      ]
    );
  }

  private async suggestWithGemini(
    dto: JobDescriptionSuggestionsDto,
    apiKey: string,
  ): Promise<JobDescriptionSuggestionsResult> {
    const model =
      this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.0-flash';

    const system = `You help homeowners improve job postings on a contractor marketplace.
Given a job title, work type, and description draft, identify important details that are MISSING and that contractors need to bid accurately.

Return ONLY valid JSON in this shape:
{"suggestions":[{"topic":"short label","prompt":"question for the homeowner"}]}

Rules:
- Suggest 2-5 items max
- Only suggest details not already covered in the description
- Tailor every suggestion to the specific job described — read the title and description carefully
- Be specific (e.g. water heater size, gas vs electric, palm species, gravel type, haul-away of old unit)
- Include logistical constraints when relevant (narrow driveway, gate width, stairs, permit needs, delivery placement)
- Do NOT suggest generic filler if the job is already specific; suggest only what is still missing
- Prompts should be concise questions the homeowner can answer in one sentence

Examples:
- "Install 2 palm trees" → ask about species/size, who supplies trees, planting locations, equipment access, stump/irrigation prep
- "Gravel delivery" → ask gravel type, quantity, dump location, driveway/access constraints`;

    const user = `Title: ${dto.title}
Work type: ${dto.workType}
Description:
${dto.description.trim() || '(empty)'}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${system}\n\n${user}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('Gemini returned empty content');
    }

    const parsed = JSON.parse(content) as { suggestions?: JobDescriptionSuggestion[] };
    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => s?.topic?.trim() && s?.prompt?.trim())
      .slice(0, 5)
      .map((s) => ({ topic: s.topic.trim(), prompt: s.prompt.trim() }));

    if (!suggestions.length) {
      return { suggestions: this.suggestWithHeuristics(dto) };
    }

    return { suggestions };
  }
}
