import {useEffect, useMemo, useRef, useState} from "react";
import {buildDeviceTreeData, findTreeMatches} from "../lib/deviceTreeData";
import type {FlatDeviceNode} from "../lib/deviceTreeData";

/** Пауза после последнего символа, прежде чем искать: дерево не раскрывается на каждую букву. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Поиск по дереву устройств: запрос с паузой, совпадения, переход по ним.
 *
 * `reveal` раскрывает путь до узла и прокручивает к нему; `open` открывает его параметры
 * (как щелчок). Поиск по паузе только показывает найденное, а Enter и стрелки «назад/вперёд»
 * ещё и открывают узел — раньше Enter лишь подсвечивал его (#16 п. 10).
 */
export function useDeviceTreeSearch({nodes, selected, reveal, open}: {
  nodes: FlatDeviceNode[];
  /** Открытый сейчас узел: Enter на нём уже не открывает, а идёт к следующему совпадению. */
  selected: string | null;
  reveal: (key: string) => void;
  open: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  // Запрос, по которому реально искали (после паузы или по Enter).
  const [appliedQuery, setAppliedQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Структура для поиска — без подписей: дерево с подписями пересобирается при смене
  // подсвеченного узла, а совпадения от подсветки не зависят.
  const searchTree = useMemo(() => buildDeviceTreeData(nodes, () => null), [nodes]);
  const matches = useMemo(() => findTreeMatches(searchTree, appliedQuery), [searchTree, appliedQuery]);
  const activeMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : null;

  const runSearch = (text: string, openFound: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const found = findTreeMatches(searchTree, text);
    setAppliedQuery(text);
    setMatchIndex(0);
    if (!found.length) return;
    reveal(found[0]);
    if (openFound) open(found[0]);
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim() === "") {
      setAppliedQuery("");
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(text, false), SEARCH_DEBOUNCE_MS);
  };

  const goToMatch = (delta: number) => {
    if (!matches.length) return;
    const next = (Math.min(matchIndex, matches.length - 1) + delta + matches.length) % matches.length;
    setMatchIndex(next);
    reveal(matches[next]);
    open(matches[next]);
  };

  const searchPending = query.trim() !== "" && query !== appliedQuery;
  const searchActive = appliedQuery.trim() !== "";

  /**
   * Enter до истечения паузы ищет сразу и открывает первое совпадение. Первый Enter после
   * паузы открывает уже подсвеченное, следующие — идут по совпадениям.
   */
  const enter = (back: boolean) => {
    if (searchPending) runSearch(query, true);
    else if (activeMatch && activeMatch !== selected) open(activeMatch);
    else goToMatch(back ? -1 : 1);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    query,
    handleQueryChange,
    enter,
    clear: () => handleQueryChange(""),
    goToMatch,
    activeMatch,
    matches,
    status: searchActive && !searchPending
      ? (matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} / ${matches.length}` : "не найдено")
      : null,
  };
}
