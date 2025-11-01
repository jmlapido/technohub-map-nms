import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatusPage from '../page'
import { networkApi } from '@/lib/api'

// Mock the network API
jest.mock('@/lib/api', () => ({
  networkApi: {
    getStatus: jest.fn(),
    getPublicConfig: jest.fn(),
  },
}))

// Mock the TelemetryToast component
jest.mock('@/components/TelemetryToast', () => ({
  emitTelemetry: jest.fn(),
  default: () => null,
}))

const mockNetworkApi = networkApi as jest.Mocked<typeof networkApi>

const buildTopologySettings = () => ({
  topology: {
    showRemoteAreas: true,
    showLinkLatency: true,
    preferCompactLayout: false,
    autoIncludeUnlinkedDevices: true,
  },
})

describe('StatusPage Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading skeleton on initial load', () => {
    mockNetworkApi.getStatus.mockImplementation(() => new Promise(() => {})) // Never resolves
    mockNetworkApi.getPublicConfig.mockImplementation(() => new Promise(() => {}))
    
    render(<StatusPage />)
    
    // Should show loading state with skeleton
    expect(screen.getByRole('status', { name: '' })).toBeInTheDocument()
  })

  it('renders status data after successful load', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [
            { deviceId: 'device1', status: 'up', latency: 10, lastChecked: new Date().toISOString() },
          ],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Test Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Network Status/i)).toBeInTheDocument()
    })

    // Should display network health
    expect(screen.getByRole('region', { name: /network health/i })).toBeInTheDocument()
    
    // Should display legend
    expect(screen.getByRole('region', { name: /status legend/i })).toBeInTheDocument()
  })

  it('displays network health score', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [
            { deviceId: 'device1', status: 'up', latency: 10, lastChecked: new Date().toISOString() },
          ],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Test Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      const healthRegion = screen.getByRole('region', { name: /network health/i })
      expect(healthRegion).toBeInTheDocument()
    })

    // Health percentage should be displayed (use getAllByText since there are multiple)
    const healthTexts = screen.getAllByText(/\d+%/)
    expect(healthTexts.length).toBeGreaterThan(0)
  })

  it('shows error message on API failure', async () => {
    mockNetworkApi.getStatus.mockRejectedValueOnce(new Error('Network error'))
    mockNetworkApi.getPublicConfig.mockRejectedValueOnce(new Error('Network error'))

    render(<StatusPage />)

    await waitFor(() => {
      // Should show "No data available" message
      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
  })

  it('filters areas by search query', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [],
        },
        {
          areaId: 'area2',
          status: 'up',
          devices: [],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Home Office', type: 'Homes', lat: 0, lng: 0 },
        { id: 'area2', name: 'Test Location', type: 'Schools', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Home Office').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Test Location').length).toBeGreaterThan(0)
    })

    // Search for "Home"
    const searchInput = screen.getByPlaceholderText(/search devices or areas/i)
    await userEvent.type(searchInput, 'Home')

    // Should only show Home Office
    await waitFor(() => {
      expect(screen.getAllByText('Home Office').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Test Location').length).toBe(0)
    })
  })

  it('filters by status (Online/Offline/Degraded)', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [{ deviceId: 'device1', status: 'up', latency: 10, lastChecked: new Date().toISOString() }],
        },
        {
          areaId: 'area2',
          status: 'down',
          devices: [{ deviceId: 'device2', status: 'down', lastChecked: new Date().toISOString() }],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Online Area', type: 'Homes', lat: 0, lng: 0 },
        { id: 'area2', name: 'Offline Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Online Area').length).toBeGreaterThan(0)
    })

    // Click "Offline" filter button
    const offlineButton = screen.getByRole('button', { name: /offline/i })
    await userEvent.click(offlineButton)

    // Should show only offline areas
    await waitFor(() => {
      expect(screen.getAllByText('Offline Area').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Online Area').length).toBe(0)
    })
  })

  it('displays area type statistics', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [{ deviceId: 'device1', status: 'up', latency: 10, lastChecked: new Date().toISOString() }],
        },
        {
          areaId: 'area2',
          status: 'up',
          devices: [],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Area 1', type: 'Homes', lat: 0, lng: 0 },
        { id: 'area2', name: 'Area 2', type: 'Schools', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      // Should show area type breakdown (use getAllByText since text appears multiple times)
      const homesElements = screen.getAllByText('Homes')
      const schoolsElements = screen.getAllByText('Schools')
      expect(homesElements.length).toBeGreaterThan(0)
      expect(schoolsElements.length).toBeGreaterThan(0)
    })
  })

  it('shows configured areas even when status is missing entries', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [],
      links: [],
      lastUpdate: new Date().toISOString(),
    })

    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area-config', name: 'Config Only Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [
        { id: 'device-config', areaId: 'area-config', name: 'Config Device', type: 'router', ip: '10.0.0.1' },
      ],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Config Only Area').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('Config Device').length).toBeGreaterThan(0)
  })

  it('has clear filters button when filters are active', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Test Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Test Area').length).toBeGreaterThan(0)
    })

    // Search for something to activate filters
    const searchInput = screen.getByPlaceholderText(/search devices or areas/i)
    await userEvent.type(searchInput, 'NoMatch')

    // Clear filters button should appear
    const clearButton = screen.getByRole('button', { name: /clear filters/i })
    expect(clearButton).toBeInTheDocument()

    await userEvent.click(clearButton)

    // Filters should be cleared
    expect(searchInput).toHaveValue('')
  })

  it('displays device with IP address link', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [
        {
          areaId: 'area1',
          status: 'up',
          devices: [{ deviceId: 'device1', status: 'up', latency: 10, lastChecked: new Date().toISOString() }],
        },
      ],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [
        { id: 'area1', name: 'Test Area', type: 'Homes', lat: 0, lng: 0 },
      ],
      devices: [
        { id: 'device1', name: 'Device 1', type: 'router', ip: '8.8.8.8', locationId: 'area1' },
      ],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      // Should display device with IP
      expect(screen.getAllByText('Device 1').length).toBeGreaterThan(0)
      
      // IP link should be present (use getAllByText since there might be multiple)
      const ipLinks = screen.getAllByText('8.8.8.8').filter(el => 
        el.tagName === 'A' || el.closest('a')
      )
      expect(ipLinks.length).toBeGreaterThan(0)
    })
  })

  it('has proper accessibility attributes', async () => {
    mockNetworkApi.getStatus.mockResolvedValueOnce({
      areas: [],
      links: [],
      lastUpdate: new Date().toISOString(),
    })
    
    mockNetworkApi.getPublicConfig.mockResolvedValueOnce({
      areas: [],
      devices: [],
      links: [],
      settings: buildTopologySettings(),
    })

    render(<StatusPage />)

    await waitFor(() => {
      // Health section should have region role
      const healthRegion = screen.queryByRole('region', { name: /network health/i })
      expect(healthRegion).toBeInTheDocument()
      
      // Search should have label
      const searchInput = screen.getByPlaceholderText(/search devices or areas/i)
      expect(searchInput).toHaveAttribute('aria-label')
    })
  })
})

