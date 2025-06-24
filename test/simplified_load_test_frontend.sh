#!/bin/bash

# Simplified Frontend Load Testing Script for Cloud Run
# Configured for containerConcurrency: 80, minScale: 1, maxScale: 5
# Executes only: Stress Test, Spike Test, and Scalability Test

FRONTEND_URL="http://34.13.75.10:80"  # Cambia con l'IP del tuo frontend
PROJECT_ID="grupo-10"
REGION="us-central1"
SERVICE_NAME="autonetgen-frontend"  # Cambia con il nome del servizio frontend

# Container configuration
CONTAINER_CONCURRENCY=80
MIN_INSTANCES=1
MAX_INSTANCES=5
THEORETICAL_MAX_CONCURRENT=$((CONTAINER_CONCURRENCY * MAX_INSTANCES))  # 400

# File di output
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CSV_FILE="frontend_test_results_${TIMESTAMP}.csv"
LOG_FILE="frontend_test_log_${TIMESTAMP}.log"

# Initialize CSV with proper headers
init_csv() {
    cat > "$CSV_FILE" << EOF
timestamp,test_name,endpoint,requests,concurrency,qps,duration_sec,total_requests,successful_requests,failed_requests,requests_per_sec,avg_response_time_ms,min_response_time_ms,max_response_time_ms,p50_response_time_ms,p95_response_time_ms,p99_response_time_ms,error_rate_percent,throughput_mbps,cpu_utilization_percent,memory_utilization_percent,active_instances,cold_starts,expected_instances,concurrency_per_instance
EOF
}

print_header() {
    echo -e "\n=================================================="
    echo "🔍 $1"
    echo "=================================================="
    echo "$1" >> "$LOG_FILE"
}

log_message() {
    echo "$1" | tee -a "$LOG_FILE"
}

# Calculate expected instances based on concurrency
calculate_expected_instances() {
    local concurrency=$1
    local expected_instances=$(echo "scale=0; ($concurrency + $CONTAINER_CONCURRENCY - 1) / $CONTAINER_CONCURRENCY" | bc)
    
    # Clamp to min/max scale
    if [[ $expected_instances -lt $MIN_INSTANCES ]]; then
        expected_instances=$MIN_INSTANCES
    elif [[ $expected_instances -gt $MAX_INSTANCES ]]; then
        expected_instances=$MAX_INSTANCES
    fi
    
    echo $expected_instances
}

# Fixed function to parse hey output with better error handling
parse_hey_output() {
    local hey_output="$1"
    
    # Initialize all variables with defaults
    local total_requests=0
    local successful_requests=0
    local failed_requests=0
    local requests_per_sec=0
    local avg_response_time_ms=0
    local min_response_time_ms=0
    local max_response_time_ms=0
    local p50_response_time_ms=0
    local p95_response_time_ms=0
    local p99_response_time_ms=0
    local error_rate_percent=0
    local throughput_mbps=0
    
    # Debug: Save hey output for inspection
    echo "$hey_output" > /tmp/hey_debug_${TIMESTAMP}.log
    
    # Parse total requests - look for multiple possible patterns
    total_requests=$(echo "$hey_output" | grep -E "(Total:|requests in)" | head -1 | grep -oE '[0-9]+' | head -1)
    [[ -z "$total_requests" ]] && total_requests=0
    
    # Parse successful requests - count 200 status codes
    successful_requests=$(echo "$hey_output" | grep -E "\[200\]" | grep -oE '[0-9]+' | tail -1)
    if [[ -z "$successful_requests" ]]; then
        # Alternative parsing for status codes
        successful_requests=$(echo "$hey_output" | grep -A5 "Status code distribution" | grep "200" | grep -oE '[0-9]+' | head -1)
    fi
    [[ -z "$successful_requests" ]] && successful_requests=0
    
    # Calculate failed requests
    failed_requests=$((total_requests - successful_requests))
    [[ $failed_requests -lt 0 ]] && failed_requests=0
    
    # Parse requests per second
    requests_per_sec=$(echo "$hey_output" | grep -E "Requests/sec:" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    [[ -z "$requests_per_sec" ]] && requests_per_sec=0
    
    # Parse timing metrics - convert seconds to milliseconds if needed
    avg_response_time_ms=$(echo "$hey_output" | grep -E "(Average:|Mean:)" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$avg_response_time_ms" ]]; then
        # Check if it's in seconds (value < 1 typically means seconds)
        if [[ $(echo "$avg_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
            avg_response_time_ms=$(echo "scale=2; $avg_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$avg_response_time_ms")
        fi
    else
        avg_response_time_ms=0
    fi
    
    min_response_time_ms=$(echo "$hey_output" | grep -E "Fastest:" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$min_response_time_ms" && $(echo "$min_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
        min_response_time_ms=$(echo "scale=2; $min_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$min_response_time_ms")
    fi
    [[ -z "$min_response_time_ms" ]] && min_response_time_ms=0
    
    max_response_time_ms=$(echo "$hey_output" | grep -E "Slowest:" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$max_response_time_ms" && $(echo "$max_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
        max_response_time_ms=$(echo "scale=2; $max_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$max_response_time_ms")
    fi
    [[ -z "$max_response_time_ms" ]] && max_response_time_ms=0
    
    # Parse percentiles - be more flexible with whitespace and convert if needed
    p50_response_time_ms=$(echo "$hey_output" | grep -E "50%" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$p50_response_time_ms" && $(echo "$p50_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
        p50_response_time_ms=$(echo "scale=2; $p50_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$p50_response_time_ms")
    fi
    [[ -z "$p50_response_time_ms" ]] && p50_response_time_ms=0
    
    p95_response_time_ms=$(echo "$hey_output" | grep -E "95%" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$p95_response_time_ms" && $(echo "$p95_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
        p95_response_time_ms=$(echo "scale=2; $p95_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$p95_response_time_ms")
    fi
    [[ -z "$p95_response_time_ms" ]] && p95_response_time_ms=0
    
    p99_response_time_ms=$(echo "$hey_output" | grep -E "99%" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    if [[ -n "$p99_response_time_ms" && $(echo "$p99_response_time_ms < 10" | bc -l 2>/dev/null) == "1" ]]; then
        p99_response_time_ms=$(echo "scale=2; $p99_response_time_ms * 1000" | bc -l 2>/dev/null || echo "$p99_response_time_ms")
    fi
    [[ -z "$p99_response_time_ms" ]] && p99_response_time_ms=0
    
    # Calculate error rate
    if [[ $total_requests -gt 0 ]]; then
        error_rate_percent=$(echo "scale=2; $failed_requests * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Parse throughput - look for data transferred and duration
    local data_transferred=$(echo "$hey_output" | grep -E "Data transferred:" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    local duration_sec=$(echo "$hey_output" | grep -E "Total time:" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)
    
    if [[ -n "$data_transferred" && -n "$duration_sec" && $(echo "$duration_sec > 0" | bc -l 2>/dev/null) ]]; then
        throughput_mbps=$(echo "scale=2; $data_transferred * 8 / $duration_sec / 1000000" | bc -l 2>/dev/null || echo "0")
    fi
    
    echo "$total_requests,$successful_requests,$failed_requests,$requests_per_sec,$avg_response_time_ms,$min_response_time_ms,$max_response_time_ms,$p50_response_time_ms,$p95_response_time_ms,$p99_response_time_ms,$error_rate_percent,$throughput_mbps"
}

# Get instance metrics with better error handling
get_instance_metrics() {
    local cpu_util=0
    local memory_util=0
    local active_instances=1
    local cold_starts=0
    
    # Try to get actual metrics with error handling
    if command -v gcloud >/dev/null 2>&1; then
        # Get current instance count from revision status
        local revision_info
        revision_info=$(gcloud run services describe "$SERVICE_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="json" 2>/dev/null)
        
        if [[ -n "$revision_info" ]]; then
            # Try to extract instance count from status
            active_instances=$(echo "$revision_info" | grep -o '"allocatedCount": [0-9]*' | grep -o '[0-9]*' | head -1)
            [[ -z "$active_instances" || $active_instances -eq 0 ]] && active_instances=1
        fi
    fi
    
    echo "$cpu_util,$memory_util,$active_instances,$cold_starts"
}

run_comprehensive_test() {
    local test_name="$1"
    local endpoint="$2"
    local requests="$3"
    local concurrency="$4"
    local qps="$5"
    local duration="$6"
    
    local timestamp=$(date -Iseconds)
    local full_url="$FRONTEND_URL$endpoint"
    local expected_instances=$(calculate_expected_instances $concurrency)
    local concurrency_per_instance=$(echo "scale=1; $concurrency / $expected_instances" | bc -l)
    
    print_header "$test_name"
    log_message "🌐 Endpoint: $full_url"
    log_message "📌 Richieste: ${requests:-N/A}, Concorrenza: $concurrency, QPS: ${qps:-N/A}, Durata: ${duration:-N/A}"
    log_message "🏗️ Expected instances: $expected_instances, Concurrency per instance: $concurrency_per_instance"
    log_message "🕒 $timestamp"
    
    # Pre-warm endpoint and wait for scaling
    log_message "🔥 Pre-warming endpoint and allowing for scaling..."
    curl -s --max-time 5 "$full_url" > /dev/null 2>&1 || log_message "⚠️ Pre-warm failed, continuing..."
    
    # If we expect multiple instances, do a small warm-up burst
    if [[ $expected_instances -gt 1 ]]; then
        log_message "🚀 Triggering autoscaling with burst..."
        hey -n 20 -c $concurrency "$full_url" > /dev/null 2>&1
        sleep 10  # Allow time for scaling
    else
        sleep 2
    fi
    
    # Build hey command based on parameters
    local hey_cmd="hey"
    local duration_sec=0
    
    if [[ -n "$duration" && "$duration" -gt 0 ]]; then
        hey_cmd="$hey_cmd -z ${duration}s -c $concurrency"
        duration_sec=$duration
        log_message "⏱️ Running duration-based test: ${duration}s"
    elif [[ -n "$qps" && "$qps" -gt 0 && -n "$requests" && "$requests" -gt 0 ]]; then
        hey_cmd="$hey_cmd -n $requests -c $concurrency -q $qps"
        duration_sec=$(echo "scale=1; $requests / $qps" | bc -l 2>/dev/null || echo "10")
        log_message "🎯 Running QPS-limited test: $requests requests at $qps QPS"
    elif [[ -n "$requests" && "$requests" -gt 0 ]]; then
        hey_cmd="$hey_cmd -n $requests -c $concurrency"
        log_message "📊 Running request-based test: $requests requests"
    else
        log_message "❌ Invalid test parameters"
        return 1
    fi
    
    hey_cmd="$hey_cmd \"$full_url\""
    
    # Execute hey command with timeout
    log_message "🚀 Executing: $hey_cmd"
    local start_time=$(date +%s)
    local hey_output
    
    # Add timeout to prevent hanging
    local timeout_duration=$(( $(echo "$duration_sec" | bc | awk '{printf "%.0f", $1}') + 60 ))
    [[ $timeout_duration -lt 120 ]] && timeout_duration=120
    
    hey_output=$(timeout ${timeout_duration}s bash -c "$hey_cmd" 2>&1 || echo "TIMEOUT_ERROR")
    
    local end_time=$(date +%s)
    local actual_duration=$((end_time - start_time))
    
    # Check for timeout or other errors
    if [[ "$hey_output" == "TIMEOUT_ERROR" ]]; then
        log_message "⚠️ Test timed out after ${timeout_duration}s"
        hey_output="Error: Test timed out\nTotal: 0\nRequests/sec: 0\nAverage: 0ms\nFastest: 0ms\nSlowest: 0ms"
    elif [[ -z "$hey_output" ]]; then
        log_message "⚠️ No output from hey command"
        hey_output="Error: No output\nTotal: 0\nRequests/sec: 0\nAverage: 0ms\nFastest: 0ms\nSlowest: 0ms"
    fi
    
    # Update duration if we have actual timing
    if [[ $actual_duration -gt 0 ]]; then
        duration_sec=$actual_duration
    fi
    
    # Parse results
    local hey_metrics
    hey_metrics=$(parse_hey_output "$hey_output")
    
    # Wait for metrics stabilization
    log_message "⏳ Waiting for metrics stabilization..."
    sleep 30
    
    # Get instance metrics
    local instance_metrics
    instance_metrics=$(get_instance_metrics)
    
    # Write to CSV - ensure all values are properly formatted
    echo "$timestamp,$test_name,$endpoint,${requests:-0},$concurrency,${qps:-0},$duration_sec,$hey_metrics,$instance_metrics,$expected_instances,$concurrency_per_instance" >> "$CSV_FILE"
    
    log_message "✅ Test completed - Results saved to $CSV_FILE"
    log_message "📊 Duration: ${duration_sec}s, Expected instances: $expected_instances"
    
    # Show brief status
    check_service_status
    
    # Cool down period between tests
    log_message "❄️ Cool down period..."
    sleep 180  # Extended cool down between major tests
}

check_service_status() {
    if command -v gcloud >/dev/null 2>&1; then
        log_message "\n📊 Service status:"
        gcloud run services describe "$SERVICE_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status.url)" 2>/dev/null | head -1 | tee -a "$LOG_FILE" || log_message "Could not get service status"
    fi
}

get_recent_logs() {
    if command -v gcloud >/dev/null 2>&1; then
        log_message "\n📁 Recent errors:"
        gcloud logging read \
            "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" severity>=ERROR" \
            --project="$PROJECT_ID" \
            --limit=5 \
            --format="value(timestamp,textPayload)" 2>/dev/null | tee -a "$LOG_FILE" || log_message "Could not get logs"
    fi
}

# Check prerequisites with better error messages
check_prerequisites() {
    local missing_tools=()
    
    if ! command -v hey &> /dev/null; then
        missing_tools+=("hey")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_tools+=("bc")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        echo "❌ Missing tools: ${missing_tools[*]}"
        echo "Install hey: go install github.com/rakyll/hey@latest"
        echo "Install bc: apt-get install bc (or brew install bc on macOS)"
        exit 1
    fi
    
    # Test hey installation
    if ! command -v hey >/dev/null 2>&1; then
       echo "❌ hey command not found"
       exit 1
    fi
}

# Main execution
main() {
    check_prerequisites
    init_csv
    
    print_header "SIMPLIFIED CLOUD RUN LOAD TEST - 3 TESTS ONLY"
    log_message "🌐 Frontend URL: $FRONTEND_URL"
    log_message "🏗️ Container Config: Concurrency=$CONTAINER_CONCURRENCY, Min=$MIN_INSTANCES, Max=$MAX_INSTANCES"
    log_message "📅 Timestamp: $(date)"
    log_message "📊 CSV Output: $CSV_FILE"
    log_message "📋 Log File: $LOG_FILE"
    
    # Connectivity test
    print_header "Connectivity Test"
    if curl -s --max-time 10 "$FRONTEND_URL" > /dev/null 2>&1; then
        log_message "✅ Frontend reachable"
    else
        log_message "⚠️ Frontend not reachable - continuing anyway..."
    fi
    
    # === SIMPLIFIED TEST SUITE - ONLY 3 TESTS ===
    
    # 1. STRESS TEST - Push system beyond normal capacity to find breaking point
    # High concurrency for extended period to stress the system
    print_header "STRESS TEST"
    log_message "🔥 Testing system under extreme stress - pushing beyond normal capacity"
    run_comprehensive_test "Stress Test" "/" "" 600 "" 300  # 600 concurrent for 5 minutes
    
    # 2. SPIKE TEST - Sudden burst of traffic to test autoscaling responsiveness  
    # Immediate high load without warm-up to simulate traffic spike
    print_header "SPIKE TEST"
    log_message "⚡ Testing sudden traffic spike - immediate high load"
    run_comprehensive_test "Spike Test" "/" 2000 500 "" ""  # 2000 requests with 500 concurrency (burst)
    
    # 3. SCALABILITY TEST - Gradual increase to test scaling behavior
    # Sustained load that requires multiple instances
    print_header "SCALABILITY TEST"
    log_message "📈 Testing scalability - sustained load requiring multiple instances"
    run_comprehensive_test "Scalability Test" "/" "" 320 40 240  # 320 concurrent at 40 QPS for 4 minutes (requires 4 instances)
    
    print_header "✅ ALL TESTS COMPLETED"
    get_recent_logs
    
    log_message "\n📊 RESULTS:"
    log_message "   📈 CSV: $CSV_FILE"
    log_message "   📋 Log: $LOG_FILE"
    log_message "   🐛 Debug: /tmp/hey_debug_${TIMESTAMP}.log"
    log_message "\n💡 Import $CSV_FILE into spreadsheet for analysis"
    log_message "\n🏗️ Container Configuration Summary:"
    log_message "   - Container Concurrency: $CONTAINER_CONCURRENCY"
    log_message "   - Min Instances: $MIN_INSTANCES"
    log_message "   - Max Instances: $MAX_INSTANCES"
    log_message "   - Theoretical Max Concurrent: $THEORETICAL_MAX_CONCURRENT"
    log_message "\n📋 Test Summary:"
    log_message "   1. Stress Test: 600 concurrent users for 5 minutes"
    log_message "   2. Spike Test: 2000 requests with 500 concurrent (burst)"
    log_message "   3. Scalability Test: 320 concurrent at 40 QPS for 4 minutes"
}

# Cleanup trap
trap 'echo "Test interrupted - partial results in $CSV_FILE"' INT TERM

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi