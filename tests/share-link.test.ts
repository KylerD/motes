import {describe,expect,it} from 'vitest';
import {SCENE_IDS,sceneFromPath} from '../src/scenes/edition';
import {shareLink,shareMessage} from '../src/share/link';

describe('share links',()=>{
  it.each(SCENE_IDS)('%s links to its own place page, marked as a share',scene=>{
    const url=new URL(shareLink('https://motes.sh',scene,'2026-10-03','2026-10-03'));
    expect(url.origin).toBe('https://motes.sh');
    expect(sceneFromPath(url.pathname)).toBe(scene);
    expect(url.searchParams.get('ref')).toBe('share');
    // Today's edition is the place page itself, so the link stays fresh for whoever opens it.
    expect(url.searchParams.has('day')).toBe(false);
  });
  it('keeps a revisited day, so the recipient hears the same edition',()=>{
    const url=new URL(shareLink('https://motes.sh','snow','2026-09-17','2026-10-03'));
    expect(url.searchParams.get('day')).toBe('2026-09-17');
    expect(url.searchParams.get('ref')).toBe('share');
  });
  it.each(SCENE_IDS)('%s has a short message naming the place',scene=>{
    const message=shareMessage(scene);
    expect(message.title).toMatch(/· Motes$/);
    expect(message.text.length).toBeLessThan(120);
  });
});
