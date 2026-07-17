package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/lh222k/kernel-server/internal/broker"
	"github.com/lh222k/kernel-server/internal/runtime"
)

func main() {
	token := strings.TrimSpace(os.Getenv("BROKER_TOKEN"))
	if len(token) < 32 {
		log.Fatal("BROKER_TOKEN must be at least 32 bytes")
	}
	policy := broker.Policy{
		CPU:     getenv("JUPYTER_SESSION_CPU", "1"),
		Memory:  getenv("JUPYTER_SESSION_MEMORY", "2g"),
		Pids:    positiveInt("JUPYTER_SESSION_PIDS", 128),
		Network: getenv("JUPYTER_DOCKER_NETWORK", "notebook-internal"),
	}
	images := runtime.Images{
		DataScience: getenv("JUPYTER_IMAGE_DATA_SCIENCE", runtime.DefaultImages().DataScience),
		MLCPU:       getenv("JUPYTER_IMAGE_ML_CPU", runtime.DefaultImages().MLCPU),
	}
	controller := runtime.NewDockerRuntime(nil, images)
	server := &http.Server{
		Addr:              ":" + getenv("BROKER_PORT", "3007"),
		Handler:           broker.NewServer(token, controller, policy),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      3 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	processCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errorsSeen := make(chan error, 1)
	go func() { errorsSeen <- server.ListenAndServe() }()
	log.Printf("docker broker listening on %s", server.Addr)
	select {
	case <-processCtx.Done():
	case err := <-errorsSeen:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
		return
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("broker shutdown: %v", err)
	}
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func positiveInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
