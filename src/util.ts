import format from 'date-fns/format';

export function toRoamDateUid(d: Date) {
  return isNaN(d.valueOf()) ? '' : format(d, 'MM-dd-yyyy');
}

const toRoamDate = (d: Date) =>
  isNaN(d.valueOf()) ? '' : format(d, 'MMMM do, yyyy');

export const getGraph = (): string =>
  /^#\/app\/([^/]*?)(?:\/page\/.{9,10})?$/.exec(window.location.hash)?.[1] ||
  '';

export async function findOrCreateCurrentDNPUid(): Promise<string> {
  const todayDate = new Date();
  const todayUid = toRoamDateUid(todayDate);

  // Find or create the DNP page
  const dnpPageExists = await window.roamAlphaAPI.q(`
  [:find ?e :where [?e :block/uid "${todayUid}"]]
  `)?.[0]?.[0];

  if (!dnpPageExists) {
    const todayDateTitle = toRoamDate(todayDate);
    await window.roamAlphaAPI.data.page.create({
      page: {
        uid: todayUid,
        title: todayDateTitle,
      },
    });
  }

  return todayUid;
}
