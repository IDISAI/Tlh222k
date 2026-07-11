package store

import (
	"errors"
	"os"
	"strings"
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
