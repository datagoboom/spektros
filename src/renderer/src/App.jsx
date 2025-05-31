import Routes from './routes';
import { ThemeProvider } from '@emotion/react';
import { CodeEditorProvider } from './contexts/CodeEditorContext';
import { ApiProvider } from './contexts/ApiContext';
import { InjectorProvider } from './contexts/InjectorContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ConnectedAppProvider

 } from './contexts/ConnectedAppContext';
import theme from './theme';
const App = () => {
  return (
    <>
      <ThemeProvider theme={theme}>
        <SettingsProvider>
          <ConnectedAppProvider>
            <ApiProvider>
              <CodeEditorProvider>
                <InjectorProvider>
                  <AnalysisProvider>
                    <Routes />
                  </AnalysisProvider>
                </InjectorProvider>
              </CodeEditorProvider>
            </ApiProvider>
          </ConnectedAppProvider>
        </SettingsProvider>
      </ThemeProvider>
    </>
  );
};

export default App;