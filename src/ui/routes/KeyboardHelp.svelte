<script lang="ts">
  /**
   * Static, always reachable, and stores nothing — no first-run flag, no
   * onboarding state. Steps are inline rather than links, because this is the
   * one screen a stuck user needs and the app must work offline.
   */
</script>

<h1>Typing accents and tone marks</h1>

<p class="muted">
  The app checks accents exactly — <code>si</code> and <code>sí</code> are different words, and in
  Vietnamese the tone mark <em>is</em> the meaning. Your operating system already provides the
  keyboards; nothing needs installing in the app.
</p>

<div class="card stack">
  <div>
    <h2>Windows</h2>
    <p class="muted">
      Settings → Time &amp; language → Language &amp; region → add the language, then open its
      options and add the keyboard. For Vietnamese choose <strong>Telex</strong>. Switch layouts
      with <kbd>Win</kbd> + <kbd>Space</kbd>.
    </p>
  </div>

  <div>
    <h2>macOS</h2>
    <p class="muted">
      System Settings → Keyboard → Input Sources → add the language. Vietnamese offers Telex and
      VNI. Switch with <kbd>Ctrl</kbd> + <kbd>Space</kbd>.
    </p>
  </div>

  <div>
    <h2>Linux</h2>
    <p class="muted">
      GNOME: Settings → Keyboard → Input Sources. KDE: System Settings → Keyboard → Layouts. For
      Vietnamese, install <code>ibus-unikey</code> or <code>ibus-bamboo</code> if the layout is not
      listed.
    </p>
  </div>

  <div>
    <h2>Phones</h2>
    <p class="muted">
      Both iOS and Android ship Vietnamese Telex. Add it in keyboard settings and switch with the
      globe key.
    </p>
  </div>
</div>

<div class="card">
  <h2>How Telex works</h2>
  <p class="muted">
    Letters first, tone last: <code>aa</code> → â, <code>aw</code> → ă, <code>dd</code> → đ. Then
    <code>s</code> á, <code>f</code> à, <code>r</code> ả, <code>x</code> ã, <code>j</code> ạ. So
    <code>phanr booij</code> gives <strong>phản bội</strong>.
  </p>
</div>

<button onclick={() => history.back()}>Back</button>

<style>
  h2 {
    font-size: var(--size-body);
    margin-bottom: 2px;
  }

  kbd {
    background: var(--sunken);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.9em;
  }
</style>
