FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kernel-server ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates docker-cli
COPY --from=build /out/kernel-server /usr/local/bin/kernel-server
WORKDIR /app
EXPOSE 3006
ENTRYPOINT ["kernel-server"]
