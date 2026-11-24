import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatEventDates } from '@/lib/catalog';
import { requireEventAdmin } from '@/lib/admin-guard';
import {
  DIETARY_REQUIREMENTS_QUESTION,
  PARTICIPANT_NAME_QUESTION,
  splitParticipantAnswers,
  type AnswerSnapshot,
} from '@/lib/questions';
import { slugify } from '@/lib/slug';
import { RegistrantEmails } from '@/components/admin/registrant-emails';
import {
  RegistrantsTable,
  type RegistrantColumn,
  type RegistrantRow,
} from '@/components/admin/registrants-table';

export const metadata: Metadata = { title: 'Ilmoittautuneet' };

export default async function EventRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEventAdmin();
  const { id } = await params;

  const event = await prisma.item.findUnique({ where: { id } });
  if (!event || !event.isEvent) notFound();

  const [orders, questions] = await Promise.all([
    prisma.order.findMany({
      where: {
        lines: { some: { itemId: id } },
        OR: [
          { status: { in: ['PAID', 'COMPLETED'] } },
          { status: 'RECEIVED', stripeInvoiceId: { not: null } },
          {
            status: 'CANCELLED',
            OR: [{ paidAt: { not: null } }, { stripeInvoiceId: { not: null } }],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        lines: {
          where: { itemId: id },
          select: {
            quantity: true,
            answers: true,
            participants: {
              select: { id: true, name: true, answers: true, cancelledAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.itemQuestion.findMany({
      where: { itemId: id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, prompt: true },
    }),
  ]);

  const participants = orders.flatMap((order) =>
    order.lines.flatMap((line, lineIndex) => {
      const list =
        line.participants.length > 0
          ? line.participants.map((participant) => ({
              name: participant.name,
              answers: (participant.answers as AnswerSnapshot[] | null) ?? [],
              cancelledAt: participant.cancelledAt,
            }))
          : splitParticipantAnswers(line.quantity, (line.answers as AnswerSnapshot[] | null) ?? []).map(
              (participant) => ({ ...participant, cancelledAt: null }),
            );
      return list.map((participant, participantIndex) => ({
        id: `${order.id}-${lineIndex}-${participantIndex}`,
        name: participant.name,
        answers: participant.answers,
        email: order.email,
        status:
          participant.cancelledAt || order.status === 'CANCELLED' ? 'CANCELLED' : order.status,
        createdAt: order.createdAt.toISOString(),
      }));
    }),
  );

  // One column per checkout question. The participant name is already the
  // "Nimi" column; every other answer (including the injected dietary question)
  // gets its own column. Answers to since-deleted/renamed questions are kept
  // as extra columns by prompt so no submitted data is hidden.
  const seenKeys = new Set<string>();
  const knownColumns: { key: string; label: string }[] = [];
  for (const column of [
    { key: DIETARY_REQUIREMENTS_QUESTION.id, label: DIETARY_REQUIREMENTS_QUESTION.prompt },
    ...questions.map((question) => ({ key: question.id, label: question.prompt })),
  ]) {
    if (column.key === PARTICIPANT_NAME_QUESTION.id || seenKeys.has(column.key)) continue;
    seenKeys.add(column.key);
    knownColumns.push(column);
  }
  const knownKeyByPrompt = new Map(knownColumns.map((column) => [column.label, column.key]));

  const extraLabels = new Set<string>();
  for (const participant of participants) {
    for (const answer of participant.answers) {
      if (!answer.prompt || answer.questionId === PARTICIPANT_NAME_QUESTION.id) continue;
      if (seenKeys.has(answer.questionId) || knownKeyByPrompt.has(answer.prompt)) continue;
      extraLabels.add(answer.prompt);
    }
  }
  const answerColumns = [
    ...knownColumns,
    ...[...extraLabels]
      .sort((a, b) => a.localeCompare(b, 'fi'))
      .map((label) => ({ key: `prompt:${label}`, label })),
  ];

  const rows: RegistrantRow[] = participants.map((participant) => {
    const answers = new Map<string, string>();
    for (const answer of participant.answers) {
      const value = Array.isArray(answer.answer) ? answer.answer.join(', ') : (answer.answer ?? '');
      answers.set(answer.questionId, value);
      if (answer.prompt) {
        answers.set(`prompt:${answer.prompt}`, value);
        const knownKey = knownKeyByPrompt.get(answer.prompt);
        if (knownKey) answers.set(knownKey, value);
      }
    }
    return {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      createdAt: participant.createdAt,
      status: participant.status,
      answers: Object.fromEntries(
        answerColumns.map((column) => [column.key, answers.get(column.key) ?? '']),
      ),
    };
  });

  const columns: RegistrantColumn[] = [
    { key: 'name', label: 'Nimi', kind: 'name' },
    { key: 'email', label: 'Sähköposti', kind: 'email' },
    ...answerColumns.map((column) => ({
      key: column.key,
      label: column.label,
      kind: 'answer' as const,
    })),
    { key: 'createdAt', label: 'Ilmoittautui', kind: 'date' },
    { key: 'status', label: 'Tila', kind: 'status' },
  ];

  const spots = rows.filter((row) => row.status !== 'CANCELLED').length;
  const emails = [...new Set(rows.map((row) => row.email?.trim()).filter((e): e is string => !!e))];

  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tapahtumat
      </Link>
      <h1 className="text-2xl font-bold">{event.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatEventDates(event.startsAt, event.endsAt)} · {spots}{' '}
        {spots === 1 ? 'paikka' : 'paikkaa'}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei vielä maksettuja tai laskutettuja ilmoittautumisia.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <RegistrantEmails emails={emails} subject={event.name} />
          </div>
          <div className="mt-6">
            <RegistrantsTable
              rows={rows}
              columns={columns}
              fileName={`${slugify(event.name)}-ilmoittautuneet`}
            />
          </div>
        </>
      )}
    </div>
  );
}
