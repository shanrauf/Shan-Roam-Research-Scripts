import format from 'date-fns/format';

export const getGraph = (): string =>
  /^#\/app\/([^/]*?)(?:\/page\/.{9,10})?$/.exec(window.location.hash)?.[1] ||
  '';

export async function findOrCreateCurrentDNPUid(): Promise<string> {
  const todayDate = new Date();
  
  // 8-11-23, Roam temporarily broke UIDs for DNP pages. I am now going to rely on page titles instead of UIDs...
  const todayTitle: string = window.roamAlphaAPI.util.dateToPageTitle(todayDate);
  let todayUid: string = window.roamAlphaAPI.util.dateToPageUid(todayDate);

  // Find or create the DNP page
  const dnpPageExists = await window.roamAlphaAPI.q(
    `
  [:find [(pull ?e [:block/uid])] :in $ ?today-title :where [?e :node/title ?today-title]]
  `,
    todayTitle
  )?.[0];

  if (!dnpPageExists) {
    await window.roamAlphaAPI.data.page.create({
      page: {
        uid: todayUid,
        title: todayTitle,
      },
    });
  }
  else {
    todayUid = dnpPageExists.uid;
  }

  return todayUid;
}
