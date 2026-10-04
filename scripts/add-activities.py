from pathlib import Path
p=Path('src/content/activities.ts');s=p.read_text();s="import paperless from './paperless.json'\n"+s
s=s.replace("kind: 'mystery' | 'budget' | 'billshock'", "kind: 'mystery' | 'budget' | 'billshock' | 'studio'")
a=s.index("  {\n    id: 'architecture'");b=s.index("  {\n    id: 'quiz-day1'",a)
s=s[:a]+"  { id: 'architecture', title: 'Architecture Lego: digital design', day: 1, slides: 'Day1 · Architecture Lego', kind: 'studio', intro: 'Build your design on phones. Freeze it before Day2: Poker and Bill Shock use this design.' },\n"+s[b:]
a=s.index("  {\n    id: 'downtime'");b=s.index("  {\n    id: 'mystery'",a)
s=s[:a]+"""  { id: 'downtime', title: 'Guess the Downtime', day: 2, slides: 'Day2 · Guess the Downtime', kind: 'form', scope: 'team', intro: 'Estimate annual downtime in minutes. Closest team per row in each region gets +20; ties share the award.', fields: [99,99.9,99.99,99.999].map((n,i)=>({id:`guess${i}`,type:'number',label:`${n}% availability: annual downtime (minutes)`,min:0,max:525600,required:true})) },
"""+s[b:]
a=s.index("    fields: [",s.index("id: 'treasure-hunt'"));b=s.index("\n  },",a)
s=s[:a]+"""    fields: [...paperless.questions.flatMap(q => [{ id:q.id, type:'textarea' as const, label:`${q.label} (${q.points} points)` }, {id:`${q.id}proof`,type:'text' as const,label:'Proof: number, service name or link'}]), {id:'reflection',type:'textarea',label:'What could you find faster with a query?'}],"""+s[b:]
a=s.index("  {\n    id: 'paper-planes'");b=s.index("  {\n    id: 'billshock'",a)
s=s[:a]+"  { id: 'factory', title: 'Digital Delivery Factory', day: 2, slides: 'Day2 · Digital Delivery Factory', kind: 'studio', intro: 'Compare sequential work with a team pipeline. Track successful releases, lead time, failed changes and recovery.' },\n"+s[b:]
insert="""
  { id:'timeline', title:'Human Timeline', day:1, slides:'Day1 · Timeline', kind:'studio', intro:'Reorder the events from oldest to newest. No talking for the first two minutes; COO submits when ready.' },
  { id:'service-sort', title:'Service Model Sort', day:1, slides:'Day1 · Service models', kind:'studio', intro:'Classify each card as IaaS, PaaS or SaaS. +5 per correct card.' },
  { id:'bingo', title:'Cloud Bingo', day:1, slides:'Day1 · Bingo', kind:'studio', intro:'Mark a term when the facilitator calls its clue. Complete a row, column or diagonal and submit a claim.' },
  { id:'shark-pitch', title:'Cloud Shark Tank: pitch brief', day:1, slides:'Day1 · Shark Tank', kind:'form', scope:'team', fields:[{id:'pitch',type:'textarea',label:'Our cloud choice, business value and 60-second pitch',required:true}] },
  { id:'kitchen', title:'Human Kitchen', day:1, slides:'Day1 · Human Kitchen', kind:'studio', intro:'Volunteers use station cards on phones. Follow the token, record handoffs and compare chaos with the improved round.' },
  { id:'gallery', title:'Gallery Walk', day:1, slides:'Day1 · Gallery', kind:'studio', intro:'Browse cases, discuss their questions and leave useful feedback. The facilitator awards four best notes.' },
  { id:'follow-order', title:'Follow the Order', day:2, slides:'Day2 · Business systems', kind:'studio', intro:'Seven volunteers follow a digital order through business systems. Compare a blocked ERP with queued recovery.' },
"""
s=s.replace('export const ACTIVITIES: Activity[] = [','export const ACTIVITIES: Activity[] = ['+insert)
# Semantic topic references avoid stale numbers; ordered using explicit workshop sequence below.
import re
s=re.sub(r"slides: 'Day [12] · slide[s]? [^']*'", "slides: 'Workshop activity'",s)
s=s.replace("intro: 'After drawing your architecture on chart paper", "intro: 'After building your digital architecture")
p.write_text(s)
