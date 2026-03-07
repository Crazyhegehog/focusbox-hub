import { ExternalLink, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const contractSections = [
  {
    title: "1. Vertragsparteien",
    body:
      'Dieser Partnerschaftsvertrag wird geschlossen zwischen LockIn (Teilnehmer am YES Company Programme 2026, Stiftschule Einsiedeln, Kanton Schwyz, Schweiz) und dem jeweiligen Partnerunternehmen. Beide Parteien handeln als rechtlich und wirtschaftlich selbststaendige Unternehmen.',
  },
  {
    title: "2. Praeambel",
    body:
      "LockIn betreibt eine mobile App fuer iOS und Android, mit der Nutzer handyfreie Zeit erfassen und Coins sammeln. Diese Coins koennen gegen Gutscheine von lokalen Partnerunternehmen eingeloest werden. Der Partner tritt dem Netzwerk bei, um Produkte oder Dienstleistungen ueber LockIn zu bewerben.",
  },
  {
    title: "3. Vertragsdauer und Kuendigung",
    body:
      "Der Vertrag beginnt mit Unterzeichnung beider Parteien und gilt fuer eine Mindestlaufzeit von drei Monaten. Danach verlaengert er sich automatisch, sofern keine schriftliche Kuendigung mit 30 Tagen Frist erfolgt. Wichtige Gruende fuer eine fristlose Kuendigung bleiben vorbehalten.",
  },
  {
    title: "4. Leistungen von LockIn",
    body:
      "LockIn verpflichtet sich zu monatlicher Social-Media-Promotion, einer App-Listung des Partners, anonymisierten Nutzungsstatistiken auf Anfrage sowie einer bestmoeglichen Plattformverfuegbarkeit.",
  },
  {
    title: "5. Leistungen des Partners",
    body:
      "Der Partner stellt mindestens einen aktiven Gutschein bereit, akzeptiert gueltige Gutscheine, haelt Geschaeftsinformationen aktuell, informiert Mitarbeitende ueber den Einloeseprozess und liefert Logo- bzw. Bildmaterial fuer Promotionszwecke.",
  },
  {
    title: "6. Verguetung",
    body:
      "Die Partnerschaft erfolgt ohne direkte finanzielle Verguetung. LockIn erhebt keine Partnerschaftsgebuehr; der Partner traegt die Kosten der Gutscheine als Marketingaufwand. Eine Abrechnung pro eingeloestem Gutschein findet nicht statt.",
  },
  {
    title: "7-10. Rechte, Datenschutz, Haftung und Wettbewerb",
    body:
      "Der Vertrag regelt die Marken- und Nutzungsrechte beider Parteien, Datenschutz nach schweizerischem Recht, Haftungsbeschraenkungen sowie die ausdruecklich nicht-exklusive Zusammenarbeit ohne Wettbewerbsverbot ausser gegenueber den Kernleistungen von LockIn.",
  },
  {
    title: "11-14. Vertragsende und Schlussbestimmungen",
    body:
      "Nach Vertragsende muessen bereits ausgegebene Gutscheine noch 30 Tage akzeptiert werden. Es gelten Schriftform, schweizerisches Recht und der Gerichtsstand Schwyz. Der Vertrag enthaelt zudem Anlagen fuer Gutscheinangebot sowie Kontakt- und Kommunikationsdaten.",
  },
];

const PartnerContract = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partner Contract</h1>
          <p className="text-muted-foreground font-body mt-1">
            Based on the supplied partnership agreement document
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/partnerschafts-vertrag.docx" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Download DOCX
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            LockIn Partnerschaftsvertrag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {contractSections.map((section) => (
            <section key={section.title} className="rounded-lg border border-border/60 p-4">
              <h2 className="font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerContract;
