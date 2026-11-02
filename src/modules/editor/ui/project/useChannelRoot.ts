import {useEffect, useState} from "react";
import {fetchChannelRoots, fetchChannelSites} from "../../api/channelRoots";

/**
 * Выбор базы каналов: площадка → база. Связь «проект ↔ база каналов» нигде не хранится,
 * поэтому её выбирают при каждом запросе (автопривязка, помощник).
 */
export function useChannelRoot() {
  const [sites, setSites] = useState<string[]>([]);
  const [site, setSite] = useState("");
  const [roots, setRoots] = useState<string[]>([]);
  const [root, setRoot] = useState("");
  const [isLoadingRoots, setIsLoadingRoots] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setSites(await fetchChannelSites());
      } catch (err) {
        console.error("Не удалось загрузить площадки:", err);
      }
    })();
  }, []);

  // Список баз перезапрашивается на каждую смену площадки. `cancelled` — защита от гонки:
  // ответ по прежней площадке не должен перетереть свежий (тот же приём в ChannelsToolbar).
  useEffect(() => {
    if (!site) {
      setRoots([]);
      setRoot("");
      return;
    }
    let cancelled = false;
    setIsLoadingRoots(true);
    void (async () => {
      try {
        const keys = await fetchChannelRoots(site);
        if (cancelled) return;
        setRoots(keys);
        setRoot("");
      } catch (err) {
        if (!cancelled) console.error("Не удалось загрузить базы каналов:", err);
      } finally {
        if (!cancelled) setIsLoadingRoots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site]);

  return {sites, site, setSite, roots, root, setRoot, isLoadingRoots};
}

export type ChannelRootState = ReturnType<typeof useChannelRoot>;
