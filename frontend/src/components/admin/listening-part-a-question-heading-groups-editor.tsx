"use client";

import { Plus, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  buildListeningPartAExtractSequences,
  createListeningPartAQuestionHeadingGroup,
  LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING,
  type ListeningPartAQuestionHeadingGroup,
  type ListeningPartAQuestionHeadingGroupsByExtract
} from "@/lib/listening-part-a-question-heading-groups";
import { cn } from "@/lib/utils";

type ListeningPartAQuestionHeadingGroupsEditorProps = {
  extractId: string;
  extractNumber: number;
  questionRange: string;
  groups: ListeningPartAQuestionHeadingGroup[];
  onChange: (groups: ListeningPartAQuestionHeadingGroup[]) => void;
};

export function ListeningPartAQuestionHeadingGroupsEditor({
  extractId,
  extractNumber,
  questionRange,
  groups,
  onChange
}: ListeningPartAQuestionHeadingGroupsEditorProps) {
  const sequences = buildListeningPartAExtractSequences(extractId);

  const updateGroup = (groupId: string, patch: Partial<ListeningPartAQuestionHeadingGroup>) => {
    onChange(groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));
  };

  const toggleQuestion = (groupId: string, sequence: number) => {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) {
          return {
            ...group,
            questionSequences: group.questionSequences.filter((value) => value !== sequence)
          };
        }
        const selected = new Set(group.questionSequences);
        if (selected.has(sequence)) selected.delete(sequence);
        else selected.add(sequence);
        return {
          ...group,
          questionSequences: [...selected].sort((left, right) => left - right)
        };
      })
    );
  };

  const addGroup = () => {
    onChange([...groups, createListeningPartAQuestionHeadingGroup()]);
  };

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((group) => group.id !== groupId));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label>Question group headings</Label>
          <p className="text-xs text-muted-foreground">
            Optional sub-headings within Extract {extractNumber} ({questionRange}). Each group must cover at least{" "}
            {LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING} question
            {LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING === 1 ? "" : "s"} and appears above those questions only —
            separate from the extract Questions heading above.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addGroup}>
          <Plus className="h-4 w-4" aria-hidden />
          Add heading
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
          No question headings yet. Use <span className="font-medium text-foreground">Add heading</span> to create a
          group for at least {LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING} question
          {LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING === 1 ? "" : "s"} in this extract.
        </div>
      ) : null}

      {groups.map((group, index) => {
        const selectedCount = group.questionSequences.length;
        const isValidCount = selectedCount === 0 || selectedCount >= LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING;

        return (
          <div key={group.id} className="surface-panel-subtle space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Heading {index + 1}</Badge>
                <span className={cn("text-xs", isValidCount ? "text-muted-foreground" : "text-destructive")}>
                  {selectedCount} question{selectedCount === 1 ? "" : "s"} selected
                  {!isValidCount ? ` · minimum ${LISTENING_PART_A_MIN_QUESTIONS_PER_HEADING}` : ""}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeGroup(group.id)}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                Remove
              </Button>
            </div>

            <RichTextEditor
              id={`part-a-heading-${extractId}-${group.id}`}
              minHeight="sm"
              value={group.heading}
              onChange={(heading) => updateGroup(group.id, { heading })}
              placeholder={`Write the heading shown above the assigned questions…`}
            />

            <div className="space-y-2">
              <Label>Assign questions</Label>
              <div className="flex flex-wrap gap-2">
                {sequences.map((sequence) => {
                  const selected = group.questionSequences.includes(sequence);
                  const takenElsewhere = groups.some(
                    (other) => other.id !== group.id && other.questionSequences.includes(sequence)
                  );
                  return (
                    <Button
                      key={`${group.id}-${sequence}`}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      disabled={!selected && takenElsewhere}
                      className="h-8 min-w-8 rounded-full px-3"
                      onClick={() => toggleQuestion(group.id, sequence)}
                    >
                      Q{sequence}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { ListeningPartAQuestionHeadingGroupsByExtract };
