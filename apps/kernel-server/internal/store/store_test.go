package store

import (
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
)

func TestFSStorePersistsRuntimeProfile(t *testing.T) {
	s, err := NewFSStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.Save("demo", []byte(`{"nbformat":4}`), "Demo", true, "ml-cpu"); err != nil {
		t.Fatal(err)
	}

	_, meta, err := s.Load("demo")
	if err != nil {
		t.Fatal(err)
	}
	if meta.RuntimeProfile != "ml-cpu" {
		t.Fatalf("RuntimeProfile = %q, want %q", meta.RuntimeProfile, "ml-cpu")
	}
}

func TestFSStoreMissingMetaFailsClosed(t *testing.T) {
	s, err := NewFSStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save("draft", []byte(`{"nbformat":4}`), "Draft", true, "data-science"); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(s.metaPath("draft")); err != nil {
		t.Fatal(err)
	}

	_, meta, err := s.Load("draft")
	if err != nil {
		t.Fatal(err)
	}
	if meta.Published {
		t.Fatal("missing metadata must not publish a notebook")
	}
}

func TestFSStoreCorruptMetaFailsClosed(t *testing.T) {
	s, err := NewFSStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save("broken", []byte(`{"nbformat":4}`), "Broken", true, "data-science"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(s.metaPath("broken"), []byte("not-json"), 0o644); err != nil {
		t.Fatal(err)
	}

	_, meta, err := s.Load("broken")
	if !errors.Is(err, ErrCorruptMeta) {
		t.Fatalf("Load error = %v, want ErrCorruptMeta", err)
	}
	if meta.Published {
		t.Fatal("corrupt metadata must not publish a notebook")
	}
}

func TestFSStoreSaveLeavesNoTemporaryPairFiles(t *testing.T) {
	dir := t.TempDir()
	s, err := NewFSStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save("atomic", []byte(`{"nbformat":4}`), "Atomic", false, "ml-cpu"); err != nil {
		t.Fatal(err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.Contains(entry.Name(), ".tmp-") || strings.Contains(entry.Name(), ".backup-") {
			t.Fatalf("temporary persistence artifact left behind: %s", entry.Name())
		}
	}
	_, meta, err := s.Load("atomic")
	if err != nil {
		t.Fatal(err)
	}
	if meta.RuntimeProfile != "ml-cpu" || meta.Published {
		t.Fatalf("metadata = %+v, want ml-cpu draft", meta)
	}
}

func TestInstallPairSecondBackupReservationRollsBack(t *testing.T) {
	dir := t.TempDir()
	notebookPath := dir + string(os.PathSeparator) + "demo.ipynb"
	metaPath := dir + string(os.PathSeparator) + "demo.meta.json"
	oldNotebook := []byte("old notebook")
	oldMeta := []byte("old metadata")
	if err := os.WriteFile(notebookPath, oldNotebook, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(metaPath, oldMeta, 0o644); err != nil {
		t.Fatal(err)
	}
	notebookTmp, err := writeTemp(notebookPath, []byte("new notebook"))
	if err != nil {
		t.Fatal(err)
	}
	metaTmp, err := writeTemp(metaPath, []byte("new metadata"))
	if err != nil {
		_ = os.Remove(notebookTmp)
		t.Fatal(err)
	}

	reservations := 0
	reserve := func(dir, pattern string) (string, error) {
		reservations++
		if reservations == 2 {
			return "", errors.New("injected second-backup reservation failure")
		}
		return reservePath(dir, pattern)
	}
	err = installPair([]stagedFile{
		{path: notebookPath, tmp: notebookTmp},
		{path: metaPath, tmp: metaTmp},
	}, reserve)
	if err == nil {
		t.Fatal("installPair unexpectedly succeeded")
	}

	gotNotebook, err := os.ReadFile(notebookPath)
	if err != nil {
		t.Fatal(err)
	}
	gotMeta, err := os.ReadFile(metaPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(gotNotebook) != string(oldNotebook) || string(gotMeta) != string(oldMeta) {
		t.Fatalf("canonical files changed: notebook=%q meta=%q", gotNotebook, gotMeta)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.Contains(entry.Name(), ".tmp-") || strings.Contains(entry.Name(), ".backup-") {
			t.Fatalf("rollback left temporary artifact: %s", entry.Name())
		}
	}
}

func TestFSStoreConcurrentSaveLoadKeepsNotebookMetadataPairConsistent(t *testing.T) {
	s, err := NewFSStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save("shared", []byte("body-a"), "title-a", false, "data-science"); err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	done := make(chan struct{})
	errorsSeen := make(chan error, 1)
	report := func(err error) {
		select {
		case errorsSeen <- err:
		default:
		}
	}

	var readers sync.WaitGroup
	readers.Add(1)
	go func() {
		defer readers.Done()
		<-start
		for {
			select {
			case <-done:
				return
			default:
			}
			body, meta, err := s.Load("shared")
			if err != nil {
				report(err)
				continue
			}
			pair := string(body) + "/" + meta.Title
			if pair != "body-a/title-a" && pair != "body-b/title-b" {
				report(errors.New("mixed notebook/metadata pair: " + pair))
			}
		}
	}()

	var writers sync.WaitGroup
	for i := 0; i < 4; i++ {
		body, title := []byte("body-a"), "title-a"
		if i%2 == 1 {
			body, title = []byte("body-b"), "title-b"
		}
		writers.Add(1)
		go func() {
			defer writers.Done()
			<-start
			for j := 0; j < 100; j++ {
				if _, err := s.Save("shared", body, title, false, "data-science"); err != nil {
					report(err)
					return
				}
			}
		}()
	}
	close(start)
	writers.Wait()
	close(done)
	readers.Wait()

	select {
	case err := <-errorsSeen:
		t.Fatal(err)
	default:
	}
}
